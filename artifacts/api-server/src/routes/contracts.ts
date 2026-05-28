import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, maintenanceContractsTable, customersTable, jobsTable } from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { enqueueJob } from "../lib/queue";
import { advanceNextDue, type ContractFrequency } from "../lib/contractGeneration";
import { logger } from "../lib/logger";
import { isTenantCustomer } from "../lib/tenantGuards";

const router: IRouter = Router();

const VALID_FREQUENCIES: ContractFrequency[] = ["weekly", "fortnightly", "monthly", "quarterly", "annually"];
const VALID_STATUSES = ["active", "paused", "cancelled", "completed"];

function serializeContract(c: typeof maintenanceContractsTable.$inferSelect, customerName: string) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    customerId: c.customerId,
    customerName,
    title: c.title,
    frequency: c.frequency,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    occurrences: c.occurrences ?? null,
    nextDueAt: c.nextDueAt?.toISOString() ?? null,
    status: c.status,
    pricePence: c.pricePence,
    notes: c.notes ?? null,
    addressLine1: c.addressLine1 ?? null,
    city: c.city ?? null,
    postcode: c.postcode ?? null,
    jobsGenerated: c.jobsGenerated,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// List all maintenance contracts for tenant
router.get("/v1/contracts", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const statusQ = typeof req.query.status === "string" ? req.query.status : undefined;

  const where = statusQ
    ? and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.status, statusQ))
    : eq(maintenanceContractsTable.tenantId, tenantId);

  const rows = await db
    .select({
      c: maintenanceContractsTable,
      customerName: customersTable.name,
    })
    .from(maintenanceContractsTable)
    .innerJoin(customersTable, eq(customersTable.id, maintenanceContractsTable.customerId))
    .where(where)
    .orderBy(desc(maintenanceContractsTable.createdAt));

  res.json(rows.map((r) => serializeContract(r.c, r.customerName)));
});

// Get a single contract
router.get("/v1/contracts/:contractId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [row] = await db
    .select({
      c: maintenanceContractsTable,
      customerName: customersTable.name,
    })
    .from(maintenanceContractsTable)
    .innerJoin(customersTable, eq(customersTable.id, maintenanceContractsTable.customerId))
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!row) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  res.json(serializeContract(row.c, row.customerName));
});

// Create a contract
router.post("/v1/contracts", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const {
    customerId,
    title,
    frequency,
    startDate,
    endDate,
    occurrences,
    pricePence,
    notes,
    addressLine1,
    city,
    postcode,
  } = req.body as Record<string, unknown>;

  if (!customerId || typeof customerId !== "string") {
    res.status(400).json({ error: "customerId is required" });
    return;
  }
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!frequency || !VALID_FREQUENCIES.includes(frequency as ContractFrequency)) {
    res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` });
    return;
  }
  if (!startDate) {
    res.status(400).json({ error: "startDate is required" });
    return;
  }

  // Guard: customer must belong to tenant
  if (!(await isTenantCustomer(tenantId, customerId))) {
    res.status(403).json({ error: "Customer not found" });
    return;
  }

  const parsedStart = new Date(startDate as string);
  if (isNaN(parsedStart.getTime())) {
    res.status(400).json({ error: "Invalid startDate" });
    return;
  }

  const parsedEnd = endDate ? new Date(endDate as string) : null;
  if (endDate && parsedEnd && isNaN(parsedEnd.getTime())) {
    res.status(400).json({ error: "Invalid endDate" });
    return;
  }

  // nextDueAt is initially the startDate
  const nextDueAt = parsedStart;

  const [contract] = await db
    .insert(maintenanceContractsTable)
    .values({
      tenantId,
      customerId,
      title,
      frequency: frequency as ContractFrequency,
      startDate: parsedStart,
      endDate: parsedEnd ?? undefined,
      occurrences: typeof occurrences === "number" ? occurrences : (occurrences ? Number(occurrences) : undefined),
      nextDueAt,
      pricePence: typeof pricePence === "number" ? pricePence : (pricePence ? Number(pricePence) : 0),
      notes: typeof notes === "string" ? notes : undefined,
      addressLine1: typeof addressLine1 === "string" ? addressLine1 : undefined,
      city: typeof city === "string" ? city : undefined,
      postcode: typeof postcode === "string" ? postcode : undefined,
    })
    .returning();

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "contract.created",
    message: `Maintenance contract "${title}" created`,
    metadata: { contractId: contract.id },
  });

  const [row] = await db
    .select({ c: maintenanceContractsTable, customerName: customersTable.name })
    .from(maintenanceContractsTable)
    .innerJoin(customersTable, eq(customersTable.id, maintenanceContractsTable.customerId))
    .where(eq(maintenanceContractsTable.id, contract.id));

  res.status(201).json(serializeContract(row.c, row.customerName));
});

// Update a contract
router.patch("/v1/contracts/:contractId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [existing] = await db
    .select()
    .from(maintenanceContractsTable)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const allowed = ["title", "frequency", "endDate", "occurrences", "status", "pricePence", "notes", "addressLine1", "city", "postcode", "nextDueAt"];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in req.body) {
      const v = req.body[key];
      if (key === "status" && !VALID_STATUSES.includes(v)) {
        res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
        return;
      }
      if (key === "frequency" && !VALID_FREQUENCIES.includes(v)) {
        res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` });
        return;
      }
      if ((key === "endDate" || key === "nextDueAt") && v) {
        updates[key] = new Date(v as string);
      } else {
        updates[key] = v;
      }
    }
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(maintenanceContractsTable)
    .set(updates as any)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)))
    .returning();

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "contract.updated",
    message: `Maintenance contract "${updated.title}" updated`,
    metadata: { contractId, updates },
  });

  const [row] = await db
    .select({ c: maintenanceContractsTable, customerName: customersTable.name })
    .from(maintenanceContractsTable)
    .innerJoin(customersTable, eq(customersTable.id, maintenanceContractsTable.customerId))
    .where(eq(maintenanceContractsTable.id, contractId));

  res.json(serializeContract(row.c, row.customerName));
});

// Cancel a contract
router.delete("/v1/contracts/:contractId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [existing] = await db
    .select()
    .from(maintenanceContractsTable)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  await db
    .update(maintenanceContractsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "contract.cancelled",
    message: `Maintenance contract "${existing.title}" cancelled`,
    metadata: { contractId },
  });

  res.json({ success: true });
});

// List jobs generated by this contract
router.get("/v1/contracts/:contractId/jobs", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [contract] = await db
    .select({ id: maintenanceContractsTable.id })
    .from(maintenanceContractsTable)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const jobs = await db
    .select({
      id: jobsTable.id,
      number: jobsTable.number,
      title: jobsTable.title,
      status: jobsTable.status,
      scheduledStart: jobsTable.scheduledStart,
      recurrenceIndex: jobsTable.recurrenceIndex,
    })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.parentContractId, contractId)))
    .orderBy(asc(jobsTable.recurrenceIndex), asc(jobsTable.scheduledStart));

  res.json(
    jobs.map((j) => ({
      id: j.id,
      number: j.number,
      title: j.title,
      status: j.status,
      scheduledStart: j.scheduledStart?.toISOString() ?? null,
      recurrenceIndex: j.recurrenceIndex ?? 0,
    })),
  );
});

// Manually trigger next job generation
router.post("/v1/contracts/:contractId/trigger", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [existing] = await db
    .select()
    .from(maintenanceContractsTable)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  try {
    await enqueueJob({ kind: "contract_job_generation", payload: { contractId } });
  } catch (err) {
    logger.warn({ err, contractId }, "Failed to enqueue contract_job_generation");
  }

  res.json({ success: true, message: "Job generation queued" });
});

// Skip the next occurrence (advance next_due_at without creating a job)
router.post("/v1/contracts/:contractId/skip", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const contractId = req.params["contractId"] as string;

  const [existing] = await db
    .select()
    .from(maintenanceContractsTable)
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  if (existing.status !== "active") {
    res.status(400).json({ error: "Can only skip occurrences of active contracts" });
    return;
  }
  if (!existing.nextDueAt) {
    res.status(400).json({ error: "Contract has no next due date" });
    return;
  }

  const nextDue = advanceNextDue(existing.nextDueAt, existing.frequency as ContractFrequency);

  await db
    .update(maintenanceContractsTable)
    .set({ nextDueAt: nextDue, updatedAt: new Date() })
    .where(and(eq(maintenanceContractsTable.tenantId, tenantId), eq(maintenanceContractsTable.id, contractId)));

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "contract.occurrence_skipped",
    message: `Skipped occurrence for contract "${existing.title}"; next due: ${nextDue.toISOString()}`,
    metadata: { contractId, skippedDate: existing.nextDueAt.toISOString(), nextDueAt: nextDue.toISOString() },
  });

  res.json({ success: true, nextDueAt: nextDue.toISOString() });
});

export default router;
