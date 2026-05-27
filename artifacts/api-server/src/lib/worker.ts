import { logger } from "./logger";
import {
  enqueueJob,
  claimNextJob,
  completeJob,
  failJob,
  type JobKind,
} from "./queue";
import type { WorkerJob } from "@workspace/db";
import { db, workerJobsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { runExpiryDigestOnce } from "./scheduler";
import { rollupHourly, rollupDaily } from "./usage";
import { sendEmail } from "./email";
import { reconcileFromStripeSubscription } from "./stripeReconcile";

type Handler = (job: WorkerJob) => Promise<void>;

const handlers: Partial<Record<JobKind, Handler>> = {
  send_email: async (job) => {
    const p = job.payload as any;
    await sendEmail({
      tenantId: p.tenantId,
      template: p.template,
      to: p.to,
      subject: p.subject,
      text: p.text,
      html: p.html,
      metadata: p.metadata,
    });
  },
  expiry_digest: async () => {
    await runExpiryDigestOnce();
  },
  usage_rollup: async () => {
    await rollupHourly();
  },
  usage_daily_rollup: async () => {
    await rollupDaily();
  },
  stripe_reconcile: async (job) => {
    const p = job.payload as any;
    if (p.stripeSubscriptionId) {
      await reconcileFromStripeSubscription(p.stripeSubscriptionId);
    }
  },
  failed_payment_recovery: async () => {
    // Placeholder: real implementation would re-attempt collection or notify;
    // for now we just emit an audit-friendly noop log so the schedule is real.
    logger.info("Failed-payment recovery sweep (noop)");
  },
  send_sms: async (job) => {
    // No SMS provider wired yet; log so the queue is exercised without losing the job.
    logger.info({ payload: job.payload }, "send_sms (no provider configured — logged)");
  },
  integration_sync: async (job) => {
    logger.info({ payload: job.payload }, "integration_sync (noop)");
  },
  generate_pdf: async (job) => {
    logger.info({ payload: job.payload }, "generate_pdf (noop)");
  },
};

let running = false;
let timer: NodeJS.Timeout | null = null;
const POLL_MS = 2000;

async function processOne(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;
  const handler = handlers[job.kind as JobKind];
  try {
    if (!handler) throw new Error(`No handler for kind ${job.kind}`);
    await handler(job);
    await completeJob(job.id);
    logger.debug({ jobId: job.id, kind: job.kind }, "Worker job done");
  } catch (err) {
    await failJob(job, err);
  }
  return true;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Drain a few jobs per tick to keep up under burst load.
    for (let i = 0; i < 10; i++) {
      const more = await processOne();
      if (!more) break;
    }
  } catch (err) {
    logger.error({ err }, "Worker tick error");
  } finally {
    running = false;
  }
}

// Internal cron — enqueue scheduled jobs idempotently using uniq_key per bucket.
async function enqueueScheduled(): Promise<void> {
  const now = new Date();
  const hourBucket = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}T${now.getUTCHours()}`;
  const dayBucket = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;

  await enqueueJob({
    kind: "usage_rollup",
    scheduleKey: "usage_rollup",
    uniqKey: `usage_rollup:${hourBucket}`,
  });
  await enqueueJob({
    kind: "expiry_digest",
    scheduleKey: "expiry_digest",
    uniqKey: `expiry_digest:${hourBucket}`,
  });
  // Once per UTC day (kick off after midnight)
  await enqueueJob({
    kind: "usage_daily_rollup",
    scheduleKey: "usage_daily_rollup",
    uniqKey: `usage_daily_rollup:${dayBucket}`,
  });
  await enqueueJob({
    kind: "failed_payment_recovery",
    scheduleKey: "failed_payment_recovery",
    uniqKey: `failed_payment_recovery:${dayBucket}`,
  });
}

let scheduleTimer: NodeJS.Timeout | null = null;
const SCHEDULE_POLL_MS = 5 * 60 * 1000; // every 5 min check what to enqueue

/** Start an in-process worker that polls the DB queue and dispatches jobs. */
export function startWorker(): void {
  if (timer) return;
  logger.info("Worker started (in-process queue poller)");
  timer = setInterval(() => void tick(), POLL_MS);
  void tick();
  scheduleTimer = setInterval(() => void enqueueScheduled(), SCHEDULE_POLL_MS);
  void enqueueScheduled();

  // Reset orphaned 'running' jobs whose lock has expired so a new worker can claim them.
  void db
    .update(workerJobsTable)
    .set({ status: "queued", lockedUntil: null })
    .where(and(eq(workerJobsTable.status, "running"), gt(new Date() as any, workerJobsTable.lockedUntil as any)))
    .catch(() => {});
}

export function stopWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (scheduleTimer) { clearInterval(scheduleTimer); scheduleTimer = null; }
}
