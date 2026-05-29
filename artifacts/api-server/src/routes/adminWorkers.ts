import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";
import { retryJob, ALL_JOB_KINDS } from "../lib/queue";
import { adminUsageBreakdown } from "../lib/usage";
import { logger } from "../lib/logger";
import {
  GetAdminWorkersResponse,
  RetryAdminWorkerJobResponse,
  GetAdminUsageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use("/v1/admin", requireSuperAdmin);

/** Map pg-boss state → our UI bucket. */
function bucket(state: string): "queued" | "running" | "done" | "failed" | "dead" | null {
  switch (state) {
    case "created":
    case "retry":
      return "queued";
    case "active":
      return "running";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "expired":
    case "cancelled":
      return "dead";
    default:
      return null;
  }
}

interface PgBossJobRow {
  id: string;
  name: string;
  state: string;
  retry_count: number;
  retry_limit: number;
  start_after: string;
  started_on: string | null;
  completed_on: string | null;
  created_on: string;
  output: any;
}

router.get("/v1/admin/workers", async (_req, res): Promise<void> => {
  // Union live + recently archived jobs so the UI sees completions/failures.
  let rows: PgBossJobRow[] = [];
  try {
    const liveQ = await db.execute(sql`
      SELECT id, name, state::text AS state, retry_count, retry_limit,
             start_after, started_on, completed_on, created_on, output
      FROM pgboss.job
      UNION ALL
      SELECT id, name, state::text AS state, retry_count, retry_limit,
             start_after, started_on, completed_on, created_on, output
      FROM pgboss.archive
      WHERE completed_on > now() - interval '24 hours'
         OR created_on > now() - interval '24 hours'
    `);
    rows = ((liveQ as any).rows ?? []) as PgBossJobRow[];
  } catch (err) {
    // pgboss schema not initialised yet (worker has not started); treat as empty.
    logger.debug({ err }, "pgboss query failed — schema may not be initialised yet");
    rows = [];
  }

  const depth = { queued: 0, running: 0, done: 0, failed: 0, dead: 0 };
  const byKindMap = new Map<string, { kind: string; queued: number; running: number; done: number; failed: number; dead: number }>();
  for (const k of ALL_JOB_KINDS) byKindMap.set(k, { kind: k, queued: 0, running: 0, done: 0, failed: 0, dead: 0 });

  for (const r of rows) {
    const b = bucket(r.state);
    if (!b) continue;
    depth[b]++;
    let entry = byKindMap.get(r.name);
    if (!entry) { entry = { kind: r.name, queued: 0, running: 0, done: 0, failed: 0, dead: 0 }; byKindMap.set(r.name, entry); }
    entry[b]++;
  }

  const recent = rows
    .slice()
    .sort((a, b) => {
      // node-postgres returns timestamptz as Date; coerce so this works for either.
      const ta = new Date(a.completed_on ?? a.started_on ?? a.created_on).getTime();
      const tb = new Date(b.completed_on ?? b.started_on ?? b.created_on).getTime();
      return tb - ta;
    })
    .slice(0, 100)
    .map((j) => {
      const status = bucket(j.state) ?? j.state;
      const lastError =
        j.output && typeof j.output === "object" && "message" in j.output
          ? String((j.output as any).message).slice(0, 4000)
          : null;
      return {
        id: j.id,
        kind: j.name,
        status,
        attempts: j.retry_count,
        maxAttempts: j.retry_limit + 1,
        runAt: new Date(j.start_after).toISOString(),
        startedAt: j.started_on ? new Date(j.started_on).toISOString() : null,
        completedAt: j.completed_on ? new Date(j.completed_on).toISOString() : null,
        lastError,
        scheduleKey: null,
        createdAt: new Date(j.created_on).toISOString(),
        updatedAt: new Date(j.completed_on ?? j.started_on ?? j.created_on).toISOString(),
      };
    });

  const parsed = GetAdminWorkersResponse.parse({
    depth,
    byKind: Array.from(byKindMap.values()),
    recent,
  });
  res.json(parsed);
});

router.post("/v1/admin/workers/:jobId/retry", async (req, res): Promise<void> => {
  const result = await retryJob(req.params.jobId);
  if (!result) { res.status(404).json({ error: "Job not found" }); return; }
  const now = new Date().toISOString();
  const parsed = RetryAdminWorkerJobResponse.parse({
    id: result.id,
    kind: result.kind,
    status: result.status === "created" ? "queued" : result.status,
    attempts: 0,
    maxAttempts: 5,
    runAt: now,
    startedAt: null,
    completedAt: null,
    lastError: null,
    scheduleKey: null,
    createdAt: now,
    updatedAt: now,
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
