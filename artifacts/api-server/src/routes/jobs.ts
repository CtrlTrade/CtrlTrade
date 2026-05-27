import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, isNotNull, asc, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  customersTable,
  usersTable,
  membershipsTable,
  staffAvailabilityTable,
  type Job,
} from "@workspace/db";
import {
  ListJobsResponse,
  CreateJobBody,
  GetJobResponse,
  UpdateJobBody,
  UpdateJobResponse,
  AssignJobBody,
  AssignJobResponse,
  GetScheduleResponse,
  GetScheduleQueryParams,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { emitWorkflowEvent } from "../lib/automationEngine";
import { nextJobNumber } from "../lib/numbering";
import { isTenantCustomer, isTenantVehicle, isTenantMember } from "../lib/tenantGuards";
import { enqueueJob } from "../lib/queue";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function enqueueIntegrationSync(tenantId: string, jobId: string, kind: "job.upsert" | "job.delete"): Promise<void> {
  try {
    await enqueueJob({ kind: "integration_sync", payload: { tenantId, kind, entityId: jobId } });
  } catch (err) {
    logger.warn({ err, jobId, kind }, "integration_sync enqueue failed");
  }
}

function serializeJobSummary(j: Job, customerName: string, assignedUserName: string | null) {
  return {
    id: j.id,
    number: j.number,
    title: j.title,
    status: j.status,
    customerId: j.customerId,
    customerName,
    scheduledStart: j.scheduledStart?.toISOString() ?? null,
    scheduledEnd: j.scheduledEnd?.toISOString() ?? null,
    assignedUserId: j.assignedUserId,
    assignedUserName,
    valuePence: j.valuePence,
    createdAt: j.createdAt.toISOString(),
  };
}

function serializeJob(j: Job, customerName: string, assignedUserName: string | null) {
  return {
    ...serializeJobSummary(j, customerName, assignedUserName),
    description: j.description,
    quoteId: j.quoteId,
    addressLine1: j.addressLine1,
    city: j.city,
    postcode: j.postcode,
    assignedVehicleId: j.assignedVehicleId,
  };
}

async function loadJobJoined(tenantId: string, jobId: string) {
  const [row] = await db
    .select({
      j: jobsTable,
      customerName: customersTable.name,
      assignedUserName: usersTable.name,
    })
    .from(jobsTable)
    .innerJoin(customersTable, eq(customersTable.id, jobsTable.customerId))
    .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  return row;
}

router.get("/v1/jobs", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const statusQ = req.query.status;
  const status: string | undefined = typeof statusQ === "string" ? statusQ : undefined;
  const whereClause = status
    ? and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.status, status))
    : eq(jobsTable.tenantId, tenantId);
  const rows = await db
    .select({
      j: jobsTable,
      customerName: customersTable.name,
      assignedUserName: usersTable.name,
    })
    .from(jobsTable)
    .innerJoin(customersTable, eq(customersTable.id, jobsTable.customerId))
    .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
    .where(whereClause)
    .orderBy(desc(jobsTable.createdAt));
  res.json(
    ListJobsResponse.parse(rows.map((r) => serializeJobSummary(r.j, r.customerName, r.assignedUserName))),
  );
});

const validateAssignee = isTenantMember;

router.post("/v1/jobs", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, parsed.data.customerId)));
  if (!customer) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  if (parsed.data.assignedUserId && !(await validateAssignee(tenantId, parsed.data.assignedUserId))) {
    res.status(400).json({ error: "Assignee is not a member of this tenant" });
    return;
  }
  if (parsed.data.assignedVehicleId && !(await isTenantVehicle(tenantId, parsed.data.assignedVehicleId))) {
    res.status(400).json({ error: "Vehicle not found in this tenant" });
    return;
  }
  const number = await nextJobNumber(tenantId);
  const [job] = await db
    .insert(jobsTable)
    .values({
      tenantId,
      customerId: parsed.data.customerId,
      number,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "scheduled",
      scheduledStart: parsed.data.scheduledStart ?? null,
      scheduledEnd: parsed.data.scheduledEnd ?? null,
      addressLine1: parsed.data.addressLine1 ?? null,
      city: parsed.data.city ?? null,
      postcode: parsed.data.postcode ?? null,
      assignedUserId: parsed.data.assignedUserId ?? null,
      assignedVehicleId: parsed.data.assignedVehicleId ?? null,
      valuePence: parsed.data.valuePence ?? 0,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "job.created",
    message: `Job ${job.number} created for ${customer.name}`,
  });
  await enqueueIntegrationSync(tenantId, job.id, "job.upsert");
  const ctx = (await loadJobJoined(tenantId, job.id))!;
  emitWorkflowEvent(tenantId, "job.created", {
    jobId: job.id,
    jobNumber: job.number,
    status: job.status,
    customerName: ctx.customerName,
    assignedUserName: ctx.assignedUserName,
    scheduledStart: job.scheduledStart?.toISOString() ?? null,
    valuePence: job.valuePence,
  }).catch(() => {});
  res.status(201).json(GetJobResponse.parse(serializeJob(ctx.j, ctx.customerName, ctx.assignedUserName)));
});

router.get("/v1/jobs/:jobId", requireTenant, async (req, res): Promise<void> => {
  const ctx = await loadJobJoined(req.auth!.tenant!.id, (req.params.jobId as string));
  if (!ctx) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(serializeJob(ctx.j, ctx.customerName, ctx.assignedUserName)));
});

router.patch("/v1/jobs/:jobId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (!(await isTenantCustomer(tenantId, parsed.data.customerId))) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  if (parsed.data.assignedUserId && !(await validateAssignee(tenantId, parsed.data.assignedUserId))) {
    res.status(400).json({ error: "Assignee is not a member of this tenant" });
    return;
  }
  if (parsed.data.assignedVehicleId && !(await isTenantVehicle(tenantId, parsed.data.assignedVehicleId))) {
    res.status(400).json({ error: "Vehicle not found in this tenant" });
    return;
  }
  const updates: Record<string, unknown> = {
    customerId: parsed.data.customerId,
    title: parsed.data.title,
  };
  for (const k of [
    "description",
    "status",
    "scheduledStart",
    "scheduledEnd",
    "addressLine1",
    "city",
    "postcode",
    "assignedUserId",
    "assignedVehicleId",
    "valuePence",
  ] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  const [updated] = await db
    .update(jobsTable)
    .set(updates)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, (req.params.jobId as string))))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await enqueueIntegrationSync(tenantId, updated.id, "job.upsert");
  const ctx = (await loadJobJoined(tenantId, updated.id))!;
  res.json(UpdateJobResponse.parse(serializeJob(ctx.j, ctx.customerName, ctx.assignedUserName)));
});

router.post("/v1/jobs/:jobId/assign", requireTenant, async (req, res): Promise<void> => {
  const parsed = AssignJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.assignedUserId && !(await validateAssignee(tenantId, parsed.data.assignedUserId))) {
    res.status(400).json({ error: "Assignee is not a member of this tenant" });
    return;
  }
  if (parsed.data.assignedVehicleId && !(await isTenantVehicle(tenantId, parsed.data.assignedVehicleId))) {
    res.status(400).json({ error: "Vehicle not found in this tenant" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.assignedUserId !== undefined) updates.assignedUserId = parsed.data.assignedUserId;
  if (parsed.data.assignedVehicleId !== undefined) updates.assignedVehicleId = parsed.data.assignedVehicleId;
  if (parsed.data.scheduledStart !== undefined) updates.scheduledStart = parsed.data.scheduledStart;
  if (parsed.data.scheduledEnd !== undefined) updates.scheduledEnd = parsed.data.scheduledEnd;
  const [updated] = await db
    .update(jobsTable)
    .set(updates)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, (req.params.jobId as string))))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "job.assigned",
    message: `Job ${updated.number} assignment updated`,
    metadata: parsed.data as Record<string, unknown>,
  });
  await enqueueIntegrationSync(tenantId, updated.id, "job.upsert");
  const ctx = (await loadJobJoined(tenantId, updated.id))!;
  res.json(AssignJobResponse.parse(serializeJob(ctx.j, ctx.customerName, ctx.assignedUserName)));
});

router.get("/v1/schedule", requireTenant, async (req, res): Promise<void> => {
  const parsed = GetScheduleQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const from = parsed.data.from instanceof Date ? parsed.data.from : new Date(parsed.data.from as unknown as string);
  const to = parsed.data.to instanceof Date ? parsed.data.to : new Date(parsed.data.to as unknown as string);
  const rows = await db
    .select({
      j: jobsTable,
      customerName: customersTable.name,
      assignedUserName: usersTable.name,
    })
    .from(jobsTable)
    .innerJoin(customersTable, eq(customersTable.id, jobsTable.customerId))
    .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
    .where(
      and(
        eq(jobsTable.tenantId, tenantId),
        isNotNull(jobsTable.scheduledStart),
        gte(jobsTable.scheduledStart, from),
        lte(jobsTable.scheduledStart, to),
      ),
    )
    .orderBy(asc(jobsTable.scheduledStart));

  // Load availability blocks that overlap the window for conflict detection
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);
  const availBlocks = await db
    .select({ userId: staffAvailabilityTable.userId, startDate: staffAvailabilityTable.startDate, endDate: staffAvailabilityTable.endDate })
    .from(staffAvailabilityTable)
    .where(
      and(
        eq(staffAvailabilityTable.tenantId, tenantId),
        lte(staffAvailabilityTable.startDate, toDate),
        gte(staffAvailabilityTable.endDate, fromDate),
      ),
    );

  // Build set: userId -> blocked date strings
  const blockedDates = new Map<string, Set<string>>();
  for (const block of availBlocks) {
    if (!blockedDates.has(block.userId)) blockedDates.set(block.userId, new Set());
    // Expand each day in the range
    const start = new Date(block.startDate + "T12:00:00Z");
    const end = new Date(block.endDate + "T12:00:00Z");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      blockedDates.get(block.userId)!.add(d.toISOString().slice(0, 10));
    }
  }

  res.json(
    GetScheduleResponse.parse(
      rows.map((r) => {
        const jobDate = r.j.scheduledStart!.toISOString().slice(0, 10);
        const assignedUserConflict =
          !!r.j.assignedUserId && (blockedDates.get(r.j.assignedUserId)?.has(jobDate) ?? false);
        return {
          jobId: r.j.id,
          title: `${r.j.number} · ${r.j.title}`,
          status: r.j.status,
          start: r.j.scheduledStart!.toISOString(),
          end: r.j.scheduledEnd?.toISOString() ?? null,
          assignedUserId: r.j.assignedUserId,
          assignedUserName: r.assignedUserName,
          customerName: r.customerName,
          assignedUserConflict,
        };
      }),
    ),
  );
});

export default router;
