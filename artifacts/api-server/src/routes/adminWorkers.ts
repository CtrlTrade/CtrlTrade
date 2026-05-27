import { Router, type IRouter } from "express";
import { db, workerJobsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";
import { queueDepth, retryJob } from "../lib/queue";
import { adminUsageBreakdown } from "../lib/usage";
import {
  GetAdminWorkersResponse,
  RetryAdminWorkerJobResponse,
  GetAdminUsageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireSuperAdmin);

router.get("/v1/admin/workers", async (_req, res): Promise<void> => {
  const depth = await queueDepth();
  const byKindRows = await db
    .select({
      kind: workerJobsTable.kind,
      status: workerJobsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(workerJobsTable)
    .groupBy(workerJobsTable.kind, workerJobsTable.status);
  const byKindMap = new Map<string, { kind: string; queued: number; running: number; done: number; failed: number; dead: number }>();
  for (const r of byKindRows) {
    let entry = byKindMap.get(r.kind);
    if (!entry) { entry = { kind: r.kind, queued: 0, running: 0, done: 0, failed: 0, dead: 0 }; byKindMap.set(r.kind, entry); }
    if (r.status in entry) (entry as any)[r.status] = r.count;
  }
  const recent = await db
    .select()
    .from(workerJobsTable)
    .orderBy(desc(workerJobsTable.updatedAt))
    .limit(100);
  const parsed = GetAdminWorkersResponse.parse({
    depth,
    byKind: Array.from(byKindMap.values()),
    recent: recent.map((j) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      runAt: j.runAt.toISOString(),
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
      lastError: j.lastError,
      scheduleKey: j.scheduleKey,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
  res.json(parsed);
});

router.post("/v1/admin/workers/:jobId/retry", async (req, res): Promise<void> => {
  const row = await retryJob(req.params.jobId);
  if (!row) { res.status(404).json({ error: "Job not found" }); return; }
  const parsed = RetryAdminWorkerJobResponse.parse({
    id: row.id,
    kind: row.kind,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    lastError: row.lastError,
    scheduleKey: row.scheduleKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
  res.json(parsed);
});

router.get("/v1/admin/usage", async (_req, res): Promise<void> => {
  const data = await adminUsageBreakdown();
  const parsed = GetAdminUsageResponse.parse({
    periodStart: data.start.toISOString(),
    periodEnd: data.end.toISOString(),
    totals: data.totals,
    byTenant: data.byTenant,
  });
  res.json(parsed);
});

export default router;
