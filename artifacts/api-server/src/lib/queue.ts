import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const PgBoss: any = _require("pg-boss").PgBoss ?? _require("pg-boss");
type PgBoss = any;
import { logger } from "./logger";

export type JobKind =
  | "send_email"
  | "send_sms"
  | "send_whatsapp"
  | "stripe_reconcile"
  | "expiry_digest"
  | "integration_sync"
  | "generate_pdf"
  | "usage_rollup"
  | "usage_daily_rollup"
  | "failed_payment_recovery"
  | "ai_call"
  | "voice_dispatch"
  | "notification_retry"
  | "notification_digest_daily"
  | "notification_digest_weekly"
  | "contract_job_generation";

export const ALL_JOB_KINDS: JobKind[] = [
  "send_email",
  "send_sms",
  "send_whatsapp",
  "stripe_reconcile",
  "expiry_digest",
  "integration_sync",
  "generate_pdf",
  "usage_rollup",
  "usage_daily_rollup",
  "failed_payment_recovery",
  "ai_call",
  "voice_dispatch",
  "notification_retry",
  "notification_digest_daily",
  "notification_digest_weekly",
  "contract_job_generation",
];

let _boss: PgBoss | null = null;
let _starting: Promise<PgBoss> | null = null;

/**
 * Lazy-init shared pg-boss instance. Both the API (producer) and the worker
 * process (consumer) call this — pg-boss schema-creation is idempotent.
 */
export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  if (_starting) return _starting;
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required for pg-boss");
  const boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    retentionDays: 7,
    archiveCompletedAfterSeconds: 60 * 60, // archive after 1h
    deleteAfterDays: 14,
    // 30s expire by default; callers can override per-send.
    expireInSeconds: 60 * 5,
    max: 10,
  });
  boss.on("error", (err: unknown) => logger.error({ err }, "pg-boss error"));
  _starting = boss.start().then(async () => {
    _boss = boss;
    return boss;
  }).catch((err: unknown) => {
    // Don't latch a permanently-rejected promise; allow retry on next call.
    _starting = null;
    throw err;
  }).then(async () => {
    // Ensure queues exist for all known kinds with reasonable defaults.
    for (const kind of ALL_JOB_KINDS) {
      try {
        await boss.createQueue(kind, { name: kind, policy: "standard" } as any);
      } catch (err: any) {
        // already exists / older pg-boss: ignore
        if (!String(err?.message ?? "").includes("already exists")) {
          logger.debug({ err, kind }, "createQueue noop");
        }
      }
    }
    return boss;
  });
  return _starting;
}

export interface EnqueueInput {
  kind: JobKind;
  payload?: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
  /** Idempotency key — only one job with the same singletonKey can be queued at a time. */
  singletonKey?: string;
  /** Coalesce repeats within this many seconds — used by scheduled jobs. */
  singletonSeconds?: number;
}

export async function enqueueJob(input: EnqueueInput): Promise<string | null> {
  const boss = await getBoss();
  const opts: any = {
    retryLimit: (input.maxAttempts ?? 5) - 1,
    retryDelay: 30,
    retryBackoff: true,
  };
  if (input.runAt) opts.startAfter = input.runAt;
  if (input.singletonKey) opts.singletonKey = input.singletonKey;
  if (input.singletonSeconds) opts.singletonSeconds = input.singletonSeconds;
  return boss.send(input.kind, input.payload ?? {}, opts);
}

/** Re-publish a failed/cancelled/expired job by id (admin retry button). */
export async function retryJob(jobId: string): Promise<{ id: string; kind: string; status: string } | null> {
  const boss = await getBoss();
  // pg-boss v12 getJobById requires the queue name. Look it up first from live or archive.
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const lookup = await db
    .execute(sql`
      SELECT name, state, data FROM pgboss.job WHERE id = ${jobId}
      UNION ALL
      SELECT name, state, data FROM pgboss.archive WHERE id = ${jobId}
      LIMIT 1
    `)
    .catch(() => null);
  const row = (lookup as any)?.rows?.[0] as { name: string; state: string; data: unknown } | undefined;
  if (!row) return null;
  const allowed = ["failed", "expired", "cancelled"];
  if (!allowed.includes(row.state)) {
    return { id: jobId, kind: row.name, status: row.state };
  }
  const newId = await boss.send(row.name, row.data ?? {}, { retryLimit: 4 });
  return { id: newId ?? jobId, kind: row.name, status: "created" };
}

export interface DepthCounts {
  queued: number;
  running: number;
  done: number;
  failed: number;
  dead: number;
}
