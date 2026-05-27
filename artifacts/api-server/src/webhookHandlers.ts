import { getStripeSync } from "./stripeClient";
import { reconcileFromStripeSubscription } from "./lib/stripeReconcile";
import { recordInvoicePayment } from "./routes/invoices";
import { logger } from "./lib/logger";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  platformReferralConversionsTable,
  platformReferralPartnersTable,
  platformReferralCommissionsTable,
} from "@workspace/db";

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
      if (t === "invoice.payment_succeeded") {
        try {
          await recordReferralCommission(event?.data?.object);
        } catch (err) {
          logger.warn({ err }, "Referral commission processing failed");
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

async function recordReferralCommission(invoice: any): Promise<void> {
  if (!invoice) return;
  const stripeCustomerId: string | undefined = invoice.customer;
  const stripeInvoiceId: string | undefined = invoice.id;
  const amountPaid: number = Number(invoice.amount_paid ?? 0);
  const currency: string = String(invoice.currency ?? "gbp");
  if (!stripeCustomerId || !stripeInvoiceId || amountPaid <= 0) return;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.stripeCustomerId, stripeCustomerId));
  if (!tenant) return;
  const [conv] = await db.select().from(platformReferralConversionsTable).where(eq(platformReferralConversionsTable.tenantId, tenant.id));
  if (!conv) return;
  const [partner] = await db.select().from(platformReferralPartnersTable).where(eq(platformReferralPartnersTable.id, conv.partnerId));
  if (!partner || partner.status !== "approved") return;

  // Dedupe by stripeInvoiceId
  const existing = await db.select().from(platformReferralCommissionsTable).where(eq(platformReferralCommissionsTable.stripeInvoiceId, stripeInvoiceId));
  if (existing.length > 0) return;

  // For "fixed" commission type, only pay on first paid invoice; for "recurring", every invoice.
  const isFirstPayment = !conv.firstPaidAt;
  if (partner.commissionType === "fixed" && !isFirstPayment) return;

  const commissionPence = partner.commissionType === "fixed"
    ? partner.commissionFixedPence
    : Math.round((amountPaid * partner.commissionPct) / 100);

  const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : new Date();
  const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date();

  await db.insert(platformReferralCommissionsTable).values({
    partnerId: partner.id,
    conversionId: conv.id,
    tenantId: tenant.id,
    periodStart,
    periodEnd,
    invoiceTotalPence: amountPaid,
    commissionPence,
    currency,
    status: "accrued",
    stripeInvoiceId,
  });
  await db.update(platformReferralConversionsTable).set({
    status: "paying",
    firstPaidAt: conv.firstPaidAt ?? new Date(),
  }).where(eq(platformReferralConversionsTable.id, conv.id));
}
