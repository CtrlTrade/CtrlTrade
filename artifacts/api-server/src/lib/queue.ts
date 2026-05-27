import { db, workerJobsTable, type WorkerJob } from "@workspace/db";
import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";

export type JobKind =
  | "send_email"
  | "send_sms"
  | "stripe_reconcile"
  | "expiry_digest"
  | "integration_sync"
  | "generate_pdf"
  | "usage_rollup"
  | "usage_daily_rollup"
  | "failed_payment_recovery";

export interface EnqueueInput {
  kind: JobKind;
  payload?: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
  scheduleKey?: string;
  uniqKey?: string;
}

export async function enqueueJob(input: EnqueueInput): Promise<WorkerJob | null> {
  try {
    const [row] = await db
      .insert(workerJobsTable)
      .values({
        kind: input.kind,
        payload: input.payload ?? {},
        runAt: input.runAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? 5,
        scheduleKey: input.scheduleKey ?? null,
        uniqKey: input.uniqKey ?? null,
      })
      .returning();
    return row ?? null;
  } catch (err: any) {
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      // uniq_key collision — already queued; treat as idempotent success
      return null;
    }
    throw err;
  }
}

const LOCK_DURATION_MS = 5 * 60 * 1000;

export async function claimNextJob(): Promise<WorkerJob | null> {
  const now = new Date();
  // Atomic claim: pick one queued/expired-lock row, lock it.
  const rows = await db.execute(sql`
    UPDATE worker_jobs
    SET status = 'running',
        attempts = attempts + 1,
        started_at = now(),
        locked_until = now() + interval '5 minutes',
        updated_at = now()
    WHERE id = (
      SELECT id FROM worker_jobs
      WHERE (status = 'queued' AND run_at <= now())
         OR (status = 'running' AND locked_until < now())
      ORDER BY run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);
  const row = (rows as any).rows?.[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    status: row.status,
    runAt: new Date(row.run_at),
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    scheduleKey: row.schedule_key,
    uniqKey: row.uniq_key,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as WorkerJob;
}

export async function completeJob(id: string): Promise<void> {
  await db
    .update(workerJobsTable)
    .set({ status: "done", completedAt: new Date(), lockedUntil: null, lastError: null })
    .where(eq(workerJobsTable.id, id));
}

export async function failJob(job: WorkerJob, error: unknown): Promise<void> {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const isDead = job.attempts >= job.maxAttempts;
  // Exponential backoff: 30s, 2m, 8m, 30m, 2h
  const delaySec = Math.min(7200, 30 * Math.pow(4, job.attempts - 1));
  const nextRunAt = new Date(Date.now() + delaySec * 1000);
  await db
    .update(workerJobsTable)
    .set({
      status: isDead ? "dead" : "queued",
      lastError: msg.slice(0, 4000),
      runAt: isDead ? job.runAt : nextRunAt,
      lockedUntil: null,
      completedAt: isDead ? new Date() : null,
    })
    .where(eq(workerJobsTable.id, job.id));
  logger.warn({ jobId: job.id, kind: job.kind, attempt: job.attempts, dead: isDead, err: msg }, "Worker job failed");
}

export async function retryJob(id: string): Promise<WorkerJob | null> {
  // Only re-queue failed/dead jobs; never disturb running/done/queued.
  const [row] = await db
    .update(workerJobsTable)
    .set({
      status: "queued",
      runAt: new Date(),
      lockedUntil: null,
      attempts: 0,
      lastError: null,
      completedAt: null,
    })
    .where(and(
      eq(workerJobsTable.id, id),
      or(eq(workerJobsTable.status, "failed"), eq(workerJobsTable.status, "dead")),
    ))
    .returning();
  return row ?? null;
}

export async function queueDepth(): Promise<{
  queued: number;
  running: number;
  done: number;
  failed: number;
  dead: number;
}> {
  const rows = await db
    .select({ status: workerJobsTable.status, count: sql<number>`count(*)::int` })
    .from(workerJobsTable)
    .groupBy(workerJobsTable.status);
  const out = { queued: 0, running: 0, done: 0, failed: 0, dead: 0 };
  for (const r of rows) {
    if (r.status in out) (out as any)[r.status] = r.count;
  }
  return out;
}

// Suppress unused-import warnings while keeping the imports available
// for callers that consume the same module surface.
void and; void asc; void gt; void isNull; void lt; void or;
