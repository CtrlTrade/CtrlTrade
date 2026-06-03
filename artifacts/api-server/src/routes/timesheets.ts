import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  jobCheckinsTable,
  jobsTable,
  usersTable,
  membershipsTable,
} from "@workspace/db";
import type { JobCheckin } from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import {
  JobCheckinBody,
  JobCheckoutBody,
  CreateTimesheetEntryBody,
  UpdateTimesheetEntryBody,
  RejectTimesheetEntryBody,
  ListTimesheetsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CheckinInput = JobCheckinBody;
const CheckoutInput = JobCheckoutBody;
const CreateEntryInput = CreateTimesheetEntryBody;
const UpdateEntryInput = UpdateTimesheetEntryBody;
const RejectEntryInput = RejectTimesheetEntryBody;
const TimesheetsQuery = ListTimesheetsQueryParams;

const LocationBodySchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function parseLocationBody(raw: unknown) {
  return LocationBodySchema.parse(raw);
}

function parseTimesheetsQuery(raw: unknown) {
  return TimesheetsQuery.parse(raw);
}

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

// POST /v1/jobs/:jobId/checkin — field staff checks in to a job
router.post("/v1/jobs/:jobId/checkin", requireTenant, async (req, res): Promise<void> => {
  const body = parseLocationBody(req.body);
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
      checkInLat: body.lat != null ? String(body.lat) : null,
      checkInLng: body.lng != null ? String(body.lng) : null,
      notes: body.notes,
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
  const body = parseLocationBody(req.body);
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
      checkOutLat: body.lat != null ? String(body.lat) : null,
      checkOutLng: body.lng != null ? String(body.lng) : null,
      notes: body.notes ?? open.notes,
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

// GET /v1/timesheets — weekly timesheet grouped by user + day
router.get("/v1/timesheets", requireTenant, async (req, res): Promise<void> => {
  const q = parseTimesheetsQuery(req.query);
  const tenantId = req.auth!.tenant!.id;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const from = q.from ? new Date(q.from) : defaultFrom;
  const to = q.to ? new Date(q.to + "T23:59:59Z") : now;

  const conditions = [
    eq(jobCheckinsTable.tenantId, tenantId),
    gte(jobCheckinsTable.checkedInAt, from),
    lte(jobCheckinsTable.checkedInAt, to),
  ];
  if (q.userId) {
    conditions.push(eq(jobCheckinsTable.userId, q.userId));
  }

  const rows = await db
    .select({
      c: jobCheckinsTable,
      userName: usersTable.name,
      jobNumber: jobsTable.number,
      jobTitle: jobsTable.title,
    })
    .from(jobCheckinsTable)
    .leftJoin(usersTable, eq(usersTable.id, jobCheckinsTable.userId))
    .leftJoin(jobsTable, eq(jobsTable.id, jobCheckinsTable.jobId))
    .where(and(...conditions))
    .orderBy(desc(jobCheckinsTable.checkedInAt));

  // Group by userId + date
  const grouped = new Map<string, {
    userId: string;
    userName: string | null;
    date: string;
    totalMinutes: number;
    entries: ReturnType<typeof serializeCheckin>[];
  }>();

  for (const r of rows) {
    const dateStr = r.c.checkedInAt.toISOString().slice(0, 10);
    const key = `${r.c.userId}:${dateStr}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        userId: r.c.userId,
        userName: r.userName ?? null,
        date: dateStr,
        totalMinutes: 0,
        entries: [],
      });
    }
    const group = grouped.get(key)!;
    group.totalMinutes += r.c.durationMinutes ?? 0;
    group.entries.push(serializeCheckin(r.c, r.jobNumber ?? null, r.jobTitle ?? null, r.userName ?? null));
  }

  const result = Array.from(grouped.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.userName ?? "").localeCompare(b.userName ?? "");
  });

  res.json(result);
});

export default router;
