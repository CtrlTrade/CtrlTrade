import { getStripeSync } from "./stripeClient";
import { reconcileFromStripeSubscription } from "./lib/stripeReconcile";
import { logger } from "./lib/logger";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error("STRIPE WEBHOOK ERROR: Payload must be a Buffer.");
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Best-effort reconciliation: parse event and update our subscriptions row
    try {
      const event = JSON.parse(payload.toString("utf8"));
      const t = event?.type as string | undefined;
      if (!t) return;
      if (
        t.startsWith("customer.subscription.") ||
        t === "invoice.payment_succeeded" ||
        t === "invoice.payment_failed" ||
        t === "customer.subscription.trial_will_end"
      ) {
        const subId: string | undefined =
          event?.data?.object?.subscription || event?.data?.object?.id;
        if (subId && typeof subId === "string" && subId.startsWith("sub_")) {
          await reconcileFromStripeSubscription(subId, t);
        }
      }
    } catch (err) {
      logger.warn({ err }, "Webhook reconciliation failed");
    }
  }
}
