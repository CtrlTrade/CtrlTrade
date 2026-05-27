import { logger } from "./logger";
import { getBoss, type JobKind } from "./queue";
import { runExpiryDigestOnce } from "./scheduler";
import { rollupHourly, rollupDaily, recordUsage } from "./usage";
import { sendEmail } from "./email";
import { sendSmsViaTwilio, sendWhatsAppViaTwilio } from "./twilio";
import { processDeliveryRetries } from "./notifications";
import { reconcileFromStripeSubscription } from "./stripeReconcile";
import { db, tenantsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

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
    // sendEmail itself records "email" usage on provider success.
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
    // Daily sweep: look up tenants with past_due Stripe state and re-reconcile.
    // Real dunning (re-attempting collection) is provider-side; this
    // re-reconciles so admin dashboards reflect any state changes.
    const rows = await db
      .select({ id: tenantsTable.id, stripeSubscriptionId: tenantsTable.stripeSubscriptionId })
      .from(tenantsTable)
      .where(inArray(tenantsTable.status, ["past_due", "unpaid"]));
    let touched = 0;
    for (const r of rows) {
      if (!r.stripeSubscriptionId) continue;
      try {
        await reconcileFromStripeSubscription(r.stripeSubscriptionId);
        touched++;
      } catch (err) {
        logger.warn({ err, tenantId: r.id }, "failed_payment_recovery: reconcile error");
      }
    }
    logger.info({ touched, scanned: rows.length }, "Failed-payment recovery sweep complete");
  },
  send_sms: async (p) => {
    if (!p?.to || !p?.text) {
      logger.warn({ payload: p }, "send_sms: missing to/text");
      return;
    }
    const sid = await sendSmsViaTwilio(p.to, p.text);
    logger.info({ to: p.to, sid }, sid ? "send_sms sent" : "send_sms logged (no provider)");
    if (p?.tenantId) await recordUsage(p.tenantId, "sms", 1, { to: p.to });
  },
  send_whatsapp: async (p) => {
    if (!p?.to || !p?.text) {
      logger.warn({ payload: p }, "send_whatsapp: missing to/text");
      return;
    }
    const sid = await sendWhatsAppViaTwilio(p.to, p.text);
    logger.info({ to: p.to, sid }, sid ? "send_whatsapp sent" : "send_whatsapp logged (no provider)");
    if (p?.tenantId) await recordUsage(p.tenantId, "whatsapp", 1, { to: p.to });
  },
  integration_sync: async (p) => {
    logger.info({ payload: p }, "integration_sync (no integration provider wired — logged)");
  },
  generate_pdf: async (p) => {
    logger.info({ payload: p }, "generate_pdf (no renderer wired — logged)");
    if (p?.tenantId) await recordUsage(p.tenantId, "pdf_generated", 1);
  },
  ai_call: async (p) => {
    // AI client not yet wired (out of scope here); record token usage from
    // the payload so cost/limit dashboards work even before the provider lands.
    logger.info({ payload: p }, "ai_call (no provider configured — logged)");
    if (p?.tenantId) {
      const tokens = Math.max(1, Number(p.tokens ?? 1));
      await recordUsage(p.tenantId, "ai_call", tokens, { prompt: p.prompt });
    }
  },
  notification_retry: async () => {
    const { retried, succeeded } = await processDeliveryRetries(50);
    if (retried > 0) logger.info({ retried, succeeded }, "notification_retry sweep");
  },
  voice_dispatch: async (p) => {
    logger.info({ payload: p }, "voice_dispatch (no provider configured — logged)");
    if (p?.tenantId) {
      const minutes = Math.max(1, Number(p.minutes ?? 1));
      await recordUsage(p.tenantId, "voice_minute", minutes, { to: p.to });
    }
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
 *
 * Cadence:
 *   - usage_rollup           hourly  (top of hour)
 *   - expiry_digest          hourly  (top of hour) — re-emits at most once per day per tenant via audit-log dedupe
 *   - usage_daily_rollup     daily   (02:00 UTC)
 *   - failed_payment_recovery daily  (03:00 UTC)
 */
export async function registerSchedules(): Promise<void> {
  const boss = await getBoss();
  await boss.schedule("usage_rollup", "0 * * * *", {}, { tz: "UTC" } as any);
  await boss.schedule("expiry_digest", "0 * * * *", {}, { tz: "UTC" } as any);
  await boss.schedule("usage_daily_rollup", "0 2 * * *", {}, { tz: "UTC" } as any);
  await boss.schedule("failed_payment_recovery", "0 3 * * *", {}, { tz: "UTC" } as any);
  // Sweep failed notification_deliveries every 5 minutes for due retries.
  await boss.schedule("notification_retry", "*/5 * * * *", {}, { tz: "UTC" } as any);
  logger.info("Worker schedules registered (hourly expiry+rollup, daily summary+dunning, 5-min notify retry)");
}
