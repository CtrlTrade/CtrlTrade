import { logger } from "./logger";
import { getBoss, type JobKind } from "./queue";
import { runExpiryDigestOnce } from "./scheduler";
import { rollupHourly, rollupDaily } from "./usage";
import { sendEmail } from "./email";
import { reconcileFromStripeSubscription } from "./stripeReconcile";

type Handler = (payload: any) => Promise<void>;

const handlers: Record<JobKind, Handler> = {
  send_email: async (p) => {
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
  stripe_reconcile: async (p) => {
    if (p?.stripeSubscriptionId) {
      await reconcileFromStripeSubscription(p.stripeSubscriptionId);
    }
  },
  failed_payment_recovery: async () => {
    // Stub: real implementation would re-attempt collection or notify;
    // for now logged so the cron is observable.
    logger.info("Failed-payment recovery sweep (noop)");
  },
  send_sms: async (p) => {
    // No SMS provider wired yet; once Twilio/Vonage is integrated, do the send here
    // and call recordUsage(tenantId, "sms").
    logger.info({ payload: p }, "send_sms (no provider configured — logged)");
  },
  integration_sync: async (p) => {
    logger.info({ payload: p }, "integration_sync (no integration provider wired — logged)");
  },
  generate_pdf: async (p) => {
    logger.info({ payload: p }, "generate_pdf (no renderer wired — logged)");
  },
};

/** Register all job handlers on pg-boss. Called by the worker entrypoint. */
export async function registerWorkers(): Promise<void> {
  const boss = await getBoss();
  for (const [kind, handler] of Object.entries(handlers) as [JobKind, Handler][]) {
    // batchSize: 1 so that a throw fails only the offending job — never a sibling
    // whose side effect (e.g. email send) already succeeded.
    await boss.work(kind, { batchSize: 1 } as any, async (jobs: any) => {
      const list = Array.isArray(jobs) ? jobs : [jobs];
      const j = list[0];
      if (!j) return;
      try {
        await handler(j.data ?? {});
      } catch (err) {
        logger.error({ err, kind, jobId: j.id }, "Worker handler threw");
        throw err;
      }
    });
    logger.info({ kind }, "Worker handler registered");
  }
}

/**
 * Register all cron schedules. pg-boss persists schedules in its tables —
 * calling schedule() again with the same name+cron is idempotent.
 */
export async function registerSchedules(): Promise<void> {
  const boss = await getBoss();
  // hourly usage rollup
  await boss.schedule("usage_rollup", "0 * * * *", {}, { tz: "UTC" } as any);
  // daily rollup + expiry digest at 02:00 UTC
  await boss.schedule("usage_daily_rollup", "0 2 * * *", {}, { tz: "UTC" } as any);
  await boss.schedule("expiry_digest", "0 6 * * *", {}, { tz: "UTC" } as any);
  // hourly failed-payment sweep
  await boss.schedule("failed_payment_recovery", "15 * * * *", {}, { tz: "UTC" } as any);
  logger.info("Worker schedules registered (hourly+daily crons)");
}
