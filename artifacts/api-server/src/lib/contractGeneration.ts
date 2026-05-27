import { and, eq, lte, sql } from "drizzle-orm";
import { db, maintenanceContractsTable, jobsTable, customersTable, membershipsTable } from "@workspace/db";
import { logger } from "./logger";
import { nextJobNumber } from "./numbering";
import { dispatchNotification } from "./notifications";
import { logAudit } from "./audit";

export type ContractFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";

export function advanceNextDue(current: Date, frequency: ContractFrequency): Date {
  const next = new Date(current);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "fortnightly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "annually":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/**
 * Generate the next job for a single maintenance contract, then advance
 * next_due_at. If the contract has expired (end date passed or occurrences
 * exhausted) mark it completed instead.
 */
export async function generateNextJobForContract(contractId: string): Promise<{ created: boolean; reason?: string }> {
  const [contract] = await db
    .select()
    .from(maintenanceContractsTable)
    .where(eq(maintenanceContractsTable.id, contractId));

  if (!contract) return { created: false, reason: "not_found" };
  if (contract.status !== "active") return { created: false, reason: `status_${contract.status}` };

  const now = new Date();

  // Check if exhausted by occurrences
  if (contract.occurrences !== null && contract.occurrences !== undefined && contract.jobsGenerated >= contract.occurrences) {
    await db
      .update(maintenanceContractsTable)
      .set({ status: "completed", updatedAt: now })
      .where(eq(maintenanceContractsTable.id, contractId));
    return { created: false, reason: "occurrences_exhausted" };
  }

  // Check if expired by end date
  if (contract.endDate && contract.endDate < now) {
    await db
      .update(maintenanceContractsTable)
      .set({ status: "completed", updatedAt: now })
      .where(eq(maintenanceContractsTable.id, contractId));
    return { created: false, reason: "end_date_passed" };
  }

  const recurrenceIndex = contract.jobsGenerated + 1;
  const totalLabel = contract.occurrences ? ` of ${contract.occurrences}` : "";
  const jobNumber = await nextJobNumber(contract.tenantId);

  const [newJob] = await db
    .insert(jobsTable)
    .values({
      tenantId: contract.tenantId,
      customerId: contract.customerId,
      number: jobNumber,
      title: contract.title,
      description: contract.notes ?? undefined,
      status: "scheduled",
      addressLine1: contract.addressLine1 ?? undefined,
      city: contract.city ?? undefined,
      postcode: contract.postcode ?? undefined,
      valuePence: contract.pricePence,
      parentContractId: contract.id,
      recurrenceIndex,
      scheduledStart: contract.nextDueAt ?? now,
    })
    .returning();

  const nextDue = advanceNextDue(contract.nextDueAt ?? now, contract.frequency as ContractFrequency);

  await db
    .update(maintenanceContractsTable)
    .set({
      nextDueAt: nextDue,
      jobsGenerated: recurrenceIndex,
      updatedAt: now,
    })
    .where(eq(maintenanceContractsTable.id, contractId));

  await logAudit({
    tenantId: contract.tenantId,
    kind: "contract.job_generated",
    message: `Job ${jobNumber} generated from contract "${contract.title}" (recurrence ${recurrenceIndex}${totalLabel})`,
    metadata: { contractId: contract.id, jobId: newJob.id, recurrenceIndex },
  });

  logger.info({ contractId, jobId: newJob.id, recurrenceIndex }, "contract_job_generation: job created");
  return { created: true };
}

/**
 * Daily sweep: find all active contracts where next_due_at <= now, generate
 * a job for each one.
 */
export async function runContractJobGenerationOnce(now: Date = new Date()): Promise<{ generated: number; skipped: number }> {
  const due = await db
    .select()
    .from(maintenanceContractsTable)
    .where(
      and(
        eq(maintenanceContractsTable.status, "active"),
        lte(maintenanceContractsTable.nextDueAt, now),
      ),
    );

  let generated = 0;
  let skipped = 0;

  for (const contract of due) {
    try {
      const result = await generateNextJobForContract(contract.id);
      if (result.created) generated++;
      else skipped++;
    } catch (err) {
      logger.error({ err, contractId: contract.id }, "contract_job_generation: error generating job");
      skipped++;
    }
  }

  return { generated, skipped };
}

/**
 * Send expiry warnings 7 days before a contract's end_date for active contracts.
 */
export async function runContractExpiryWarnings(now: Date = new Date()): Promise<{ sent: number }> {
  const warningDate = new Date(now);
  warningDate.setDate(warningDate.getDate() + 7);

  // Contracts expiring within the next 7 days (end_date between now and now+7d)
  const expiring = await db
    .select({
      contract: maintenanceContractsTable,
      customerName: customersTable.name,
    })
    .from(maintenanceContractsTable)
    .innerJoin(customersTable, eq(customersTable.id, maintenanceContractsTable.customerId))
    .where(
      and(
        eq(maintenanceContractsTable.status, "active"),
        sql`${maintenanceContractsTable.endDate} IS NOT NULL`,
        sql`${maintenanceContractsTable.endDate} >= ${now}`,
        sql`${maintenanceContractsTable.endDate} <= ${warningDate}`,
      ),
    );

  let sent = 0;
  for (const { contract, customerName } of expiring) {
    // Get staff members for this tenant
    const staff = await db
      .select({ userId: membershipsTable.userId })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.tenantId, contract.tenantId),
          eq(membershipsTable.status, "active"),
        ),
      );

    const recipientUserIds = staff.map((s) => s.userId);
    if (!recipientUserIds.length) continue;

    const expiryDate = contract.endDate!.toLocaleDateString("en-GB");
    await dispatchNotification({
      tenantId: contract.tenantId,
      eventKind: "contract.expiry_warning",
      recipientUserIds,
      subject: `Contract expiring soon: ${contract.title}`,
      text: `The maintenance contract "${contract.title}" for customer ${customerName} is due to expire on ${expiryDate}. Please review and renew if required.`,
      vars: {
        contractTitle: contract.title,
        customerName,
        expiryDate,
      },
    });

    sent++;
    logger.info({ contractId: contract.id, expiryDate }, "contract.expiry_warning sent");
  }

  return { sent };
}
