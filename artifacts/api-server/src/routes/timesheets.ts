import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import {
  JobCheckinBody,
  JobCheckoutBody,
  CreateTimesheetEntryBody,
  UpdateTimesheetEntryBody,
  RejectTimesheetEntryBody,
} from "@workspace/api-zod";
import {
  db,
  jobCheckinsTable,
  jobsTable,
  usersTable,
  timesheetEntriesTable,
} from "@workspace/db";
import { requireTenant, requireRole } from "../middlewares/auth";
import type { JobCheckin, TimesheetEntry } from "@workspace/db";

const router: IRouter = Router();

const CheckinInput = JobCheckinBody;
const CheckoutInput = JobCheckoutBody;
const CreateEntryInput = CreateTimesheetEntryBody;
const UpdateEntryInput = UpdateTimesheetEntryBody;
const RejectEntryInput = RejectTimesheetEntryBody;

function serializeCheckin(
  c: JobCheckin,
  jobNumber: string | null,
  jobTitle: string | null,
  userName: string | null,
) {
  return {
    id: c.id,
    jobId: c.jobId,
    jobNumber,
    jobTitle,
    userId: c.userId,
    userName,
    checkedInAt: c.checkedInAt.toISOString(),
    checkedOutAt: c.checkedOutAt?.toISOString() ?? null,
    checkInLat: c.checkInLat,
    checkInLng: c.checkInLng,
    checkOutLat: c.checkOutLat,
    checkOutLng: c.checkOutLng,
    notes: c.notes,
    durationMinutes: c.durationMinutes,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeEntry(
  e: TimesheetEntry,
  userName: string | null,
  jobNumber: string | null,
  approvedByName: string | null,
) {
  return {
    id: e.id,
    userId: e.userId,
    userName,
    jobId: e.jobId ?? null,
    jobNumber,
    checkinId: e.checkinId ?? null,
    date: e.date,
    hoursWorked: parseFloat(e.hoursWorked),
    travelMinutes: e.travelMinutes,
    mileageMiles: e.mileageMiles,
    notes: e.notes ?? null,
    status: e.status,
    approvedBy: e.approvedBy ?? null,
    approvedByName,
    approvedAt: e.approvedAt?.toISOString() ?? null,
    rejectionReason: e.rejectionReason ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// POST /v1/jobs/:jobId/checkin — field staff checks in to a job
router.post("/v1/jobs/:jobId/checkin", requireTenant, async (req, res): Promise<void> => {
  const parsed = CheckinInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const jobId = req.params.jobId as string;

  const [job] = await db
    .select({ id: jobsTable.id, number: jobsTable.number, title: jobsTable.title })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [open] = await db
    .select({ id: jobCheckinsTable.id })
    .from(jobCheckinsTable)
    .where(
      and(
        eq(jobCheckinsTable.tenantId, tenantId),
        eq(jobCheckinsTable.userId, userId),
        eq(jobCheckinsTable.jobId, jobId),
        isNull(jobCheckinsTable.checkedOutAt),
      ),
    );
  if (open) {
    res.status(409).json({ error: "Already checked in to this job. Check out first." });
    return;
  }

  const [checkin] = await db
    .insert(jobCheckinsTable)
    .values({
      tenantId,
      jobId,
      userId,
      checkInLat: parsed.data.lat ?? null,
      checkInLng: parsed.data.lng ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json(serializeCheckin(checkin, job.number, job.title, user?.name ?? null));
});

// POST /v1/jobs/:jobId/checkout — field staff checks out of a job
router.post("/v1/jobs/:jobId/checkout", requireTenant, async (req, res): Promise<void> => {
  const parsed = CheckoutInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const jobId = req.params.jobId as string;

  const [job] = await db
    .select({ id: jobsTable.id, number: jobsTable.number, title: jobsTable.title })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [open] = await db
    .select()
    .from(jobCheckinsTable)
    .where(
      and(
        eq(jobCheckinsTable.tenantId, tenantId),
        eq(jobCheckinsTable.userId, userId),
        eq(jobCheckinsTable.jobId, jobId),
        isNull(jobCheckinsTable.checkedOutAt),
      ),
    );
  if (!open) {
    res.status(409).json({ error: "Not currently checked in to this job." });
    return;
  }

  const checkedOutAt = new Date();
  const durationMinutes = Math.round((checkedOutAt.getTime() - open.checkedInAt.getTime()) / 60000);

  const [updated] = await db
    .update(jobCheckinsTable)
    .set({
      checkedOutAt,
      checkOutLat: parsed.data.lat ?? null,
      checkOutLng: parsed.data.lng ?? null,
      notes: parsed.data.notes ?? open.notes,
      durationMinutes,
    })
    .where(eq(jobCheckinsTable.id, open.id))
    .returning();

  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.json(serializeCheckin(updated, job.number, job.title, user?.name ?? null));
});

// GET /v1/jobs/:jobId/checkins — list all check-ins for a job
router.get("/v1/jobs/:jobId/checkins", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const jobId = req.params.jobId as string;

  const [job] = await db
    .select({ id: jobsTable.id, number: jobsTable.number, title: jobsTable.title })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const rows = await db
    .select({
      c: jobCheckinsTable,
      userName: usersTable.name,
    })
    .from(jobCheckinsTable)
    .leftJoin(usersTable, eq(usersTable.id, jobCheckinsTable.userId))
    .where(and(eq(jobCheckinsTable.tenantId, tenantId), eq(jobCheckinsTable.jobId, jobId)))
    .orderBy(desc(jobCheckinsTable.checkedInAt));

  res.json(rows.map((r) => serializeCheckin(r.c, job.number, job.title, r.userName ?? null)));
});

// GET /v1/timesheets — list timesheet entries with optional filters
router.get("/v1/timesheets", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const membership = req.auth!.membership!;

  const fromStr = typeof req.query.from === "string" ? req.query.from : undefined;
  const toStr = typeof req.query.to === "string" ? req.query.to : undefined;
  const filterUserId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const filterStatus = typeof req.query.status === "string" ? req.query.status : undefined;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const from = fromStr ? new Date(fromStr) : defaultFrom;
  const to = toStr ? new Date(toStr + "T23:59:59Z") : now;

  const conditions: ReturnType<typeof eq>[] = [
    eq(timesheetEntriesTable.tenantId, tenantId) as any,
    gte(timesheetEntriesTable.date, from.toISOString().slice(0, 10)) as any,
    lte(timesheetEntriesTable.date, to.toISOString().slice(0, 10)) as any,
  ];

  // Non-manager/owner staff only see their own entries
  const isManager = ["owner", "admin", "manager"].includes(membership.role ?? "");
  if (!isManager) {
    conditions.push(eq(timesheetEntriesTable.userId, req.auth!.user.id) as any);
  } else if (filterUserId) {
    conditions.push(eq(timesheetEntriesTable.userId, filterUserId) as any);
  }

  if (filterStatus) {
    conditions.push(eq(timesheetEntriesTable.status, filterStatus) as any);
  }

  const approverAlias = { name: usersTable.name };
  const rows = await db
    .select({
      e: timesheetEntriesTable,
      userName: usersTable.name,
      jobNumber: jobsTable.number,
    })
    .from(timesheetEntriesTable)
    .leftJoin(usersTable, eq(usersTable.id, timesheetEntriesTable.userId))
    .leftJoin(jobsTable, eq(jobsTable.id, timesheetEntriesTable.jobId))
    .where(and(...conditions))
    .orderBy(desc(timesheetEntriesTable.date), desc(timesheetEntriesTable.createdAt));

  // Fetch approver names in a second query if needed
  const approverIds = [...new Set(rows.map((r) => r.e.approvedBy).filter(Boolean))] as string[];
  const approvers = approverIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, approverIds))
    : [];
  const approverMap = new Map(approvers.map((a) => [a.id, a.name]));

  res.json(
    rows.map((r) =>
      serializeEntry(r.e, r.userName ?? null, r.jobNumber ?? null, approverMap.get(r.e.approvedBy ?? "") ?? null),
    ),
  );
});

// POST /v1/timesheets — create a draft timesheet entry
router.post("/v1/timesheets", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateEntryInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const d = parsed.data;

  if (d.jobId) {
    const [job] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, d.jobId)));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
  }

  const [entry] = await db
    .insert(timesheetEntriesTable)
    .values({
      tenantId,
      userId,
      jobId: d.jobId ?? null,
      checkinId: d.checkinId ?? null,
      date: d.date,
      hoursWorked: String(d.hoursWorked ?? 0),
      travelMinutes: d.travelMinutes ?? 0,
      mileageMiles: d.mileageMiles ?? 0,
      notes: d.notes ?? null,
      status: "draft",
    })
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  let jobNumber: string | null = null;
  if (entry.jobId) {
    const [job] = await db.select({ number: jobsTable.number }).from(jobsTable).where(eq(jobsTable.id, entry.jobId));
    jobNumber = job?.number ?? null;
  }

  res.status(201).json(serializeEntry(entry, user?.name ?? null, jobNumber, null));
});

// PATCH /v1/timesheets/:entryId — update a draft entry
router.patch("/v1/timesheets/:entryId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateEntryInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const entryId = req.params.entryId as string;

  const [existing] = await db
    .select()
    .from(timesheetEntriesTable)
    .where(and(eq(timesheetEntriesTable.tenantId, tenantId), eq(timesheetEntriesTable.id, entryId)));
  if (!existing) {
    res.status(404).json({ error: "Timesheet entry not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Cannot edit another user's timesheet entry" });
    return;
  }
  if (existing.status !== "draft" && existing.status !== "rejected") {
    res.status(409).json({ error: "Can only edit draft or rejected entries" });
    return;
  }

  const d = parsed.data;
  const updates: Partial<typeof timesheetEntriesTable.$inferInsert> = {};
  if (d.hoursWorked !== undefined) updates.hoursWorked = String(d.hoursWorked);
  if (d.travelMinutes !== undefined) updates.travelMinutes = d.travelMinutes;
  if (d.mileageMiles !== undefined) updates.mileageMiles = d.mileageMiles;
  if (d.notes !== undefined) updates.notes = d.notes ?? null;

  const [updated] = await db
    .update(timesheetEntriesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(timesheetEntriesTable.id, entryId))
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId));
  let jobNumber: string | null = null;
  if (updated.jobId) {
    const [job] = await db.select({ number: jobsTable.number }).from(jobsTable).where(eq(jobsTable.id, updated.jobId));
    jobNumber = job?.number ?? null;
  }

  res.json(serializeEntry(updated, user?.name ?? null, jobNumber, null));
});

// POST /v1/timesheets/:entryId/submit — submit entry for approval
router.post("/v1/timesheets/:entryId/submit", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const entryId = req.params.entryId as string;

  const [existing] = await db
    .select()
    .from(timesheetEntriesTable)
    .where(and(eq(timesheetEntriesTable.tenantId, tenantId), eq(timesheetEntriesTable.id, entryId)));
  if (!existing) {
    res.status(404).json({ error: "Timesheet entry not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Cannot submit another user's timesheet entry" });
    return;
  }
  if (existing.status !== "draft" && existing.status !== "rejected") {
    res.status(409).json({ error: "Only draft or rejected entries can be submitted" });
    return;
  }

  const [updated] = await db
    .update(timesheetEntriesTable)
    .set({ status: "submitted", updatedAt: new Date() })
    .where(eq(timesheetEntriesTable.id, entryId))
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId));
  let jobNumber: string | null = null;
  if (updated.jobId) {
    const [job] = await db.select({ number: jobsTable.number }).from(jobsTable).where(eq(jobsTable.id, updated.jobId));
    jobNumber = job?.number ?? null;
  }

  res.json(serializeEntry(updated, user?.name ?? null, jobNumber, null));
});

// POST /v1/timesheets/:entryId/approve — manager/admin approves an entry
router.post(
  "/v1/timesheets/:entryId/approve",
  requireTenant,
  requireRole("owner", "admin", "manager"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const approverId = req.auth!.user.id;
    const entryId = req.params.entryId as string;

    const [existing] = await db
      .select()
      .from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.tenantId, tenantId), eq(timesheetEntriesTable.id, entryId)));
    if (!existing) {
      res.status(404).json({ error: "Timesheet entry not found" });
      return;
    }
    if (existing.status !== "submitted") {
      res.status(409).json({ error: "Only submitted entries can be approved" });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(timesheetEntriesTable)
      .set({ status: "approved", approvedBy: approverId, approvedAt: now, updatedAt: now })
      .where(eq(timesheetEntriesTable.id, entryId))
      .returning();

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId));
    const [approver] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, approverId));
    let jobNumber: string | null = null;
    if (updated.jobId) {
      const [job] = await db.select({ number: jobsTable.number }).from(jobsTable).where(eq(jobsTable.id, updated.jobId));
      jobNumber = job?.number ?? null;
    }

    res.json(serializeEntry(updated, user?.name ?? null, jobNumber, approver?.name ?? null));
  },
);

// POST /v1/timesheets/:entryId/reject — manager/admin rejects an entry
router.post(
  "/v1/timesheets/:entryId/reject",
  requireTenant,
  requireRole("owner", "admin", "manager"),
  async (req, res): Promise<void> => {
    const parsed = RejectEntryInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const entryId = req.params.entryId as string;

    const [existing] = await db
      .select()
      .from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.tenantId, tenantId), eq(timesheetEntriesTable.id, entryId)));
    if (!existing) {
      res.status(404).json({ error: "Timesheet entry not found" });
      return;
    }
    if (existing.status !== "submitted") {
      res.status(409).json({ error: "Only submitted entries can be rejected" });
      return;
    }

    const [updated] = await db
      .update(timesheetEntriesTable)
      .set({ status: "rejected", rejectionReason: parsed.data.reason, updatedAt: new Date() })
      .where(eq(timesheetEntriesTable.id, entryId))
      .returning();

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId));
    let jobNumber: string | null = null;
    if (updated.jobId) {
      const [job] = await db.select({ number: jobsTable.number }).from(jobsTable).where(eq(jobsTable.id, updated.jobId));
      jobNumber = job?.number ?? null;
    }

    res.json(serializeEntry(updated, user?.name ?? null, jobNumber, null));
  },
);

export default router;
