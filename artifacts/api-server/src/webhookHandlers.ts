import { getStripeSync } from "./stripeClient";
import { reconcileFromStripeSubscription } from "./lib/stripeReconcile";
import { recordInvoicePayment } from "./routes/invoices";
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
      if (t === "checkout.session.completed") {
        const session = event?.data?.object;
        const invoiceId: string | undefined = session?.metadata?.invoice_id;
        if (invoiceId && session?.payment_status === "paid") {
          await recordInvoicePayment({
            invoiceId,
            amountPence: Number(session.amount_total ?? 0),
            currency: String(session.currency ?? "gbp"),
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Webhook reconciliation failed");
    }
  }
}
