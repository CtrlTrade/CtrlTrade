import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@workspace/db";
import {
  GetBillingOverviewResponse,
  ListBillingInvoicesResponse,
  CreateBillingPaymentMethodSetupResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { getTenantSubscription, serializeSubscription } from "../lib/serializers";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { PRICING, computeMonthlyTotal } from "../lib/pricing";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function buildPlanItems(q: { controlSeats: number; fieldSeats: number; tills: number }, currency: string) {
  return [
    {
      key: "controlSeat",
      label: PRICING.controlSeat.name,
      quantity: q.controlSeats,
      unitAmount: PRICING.controlSeat.amount,
      subtotal: q.controlSeats * PRICING.controlSeat.amount,
      currency,
    },
    {
      key: "fieldSeat",
      label: PRICING.fieldSeat.name,
      quantity: q.fieldSeats,
      unitAmount: PRICING.fieldSeat.amount,
      subtotal: q.fieldSeats * PRICING.fieldSeat.amount,
      currency,
    },
    {
      key: "till",
      label: PRICING.till.name,
      quantity: q.tills,
      unitAmount: PRICING.till.amount,
      subtotal: q.tills * PRICING.till.amount,
      currency,
    },
  ];
}

type SyncedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

async function readSyncedPaymentMethod(
  customerId: string,
  preferredPmId: string | null,
): Promise<SyncedPaymentMethod | null> {
  try {
    const rows: any = await db.execute(sql`
      SELECT id, card
      FROM stripe.payment_methods
      WHERE customer = ${customerId}
        AND type = 'card'
      ORDER BY (id = ${preferredPmId ?? ""}) DESC, created DESC
      LIMIT 1
    `);
    const row = rows.rows?.[0];
    if (!row || !row.card) return null;
    const card = row.card as { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
    if (!card.brand || !card.last4) return null;
    return {
      id: row.id as string,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month ?? 0,
      expYear: card.exp_year ?? 0,
    };
  } catch (err) {
    logger.warn({ err }, "Failed to read synced payment method");
    return null;
  }
}

async function fetchLivePaymentMethod(
  stripe: Stripe,
  customerId: string,
  preferredPmId: string | null,
): Promise<SyncedPaymentMethod | null> {
  try {
    if (preferredPmId) {
      const pm = await stripe.paymentMethods.retrieve(preferredPmId);
      if (pm.type === "card" && pm.card) {
        return {
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    }
    const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    const pm = list.data[0];
    if (!pm?.card) return null;
    return {
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch live payment method");
    return null;
  }
}

async function fetchUpcomingInvoice(stripe: Stripe, customerId: string) {
  try {
    // Stripe SDK exposes `invoices.retrieveUpcoming` but its typing varies by version.
    const upcoming = await (stripe.invoices as any).retrieveUpcoming({ customer: customerId });
    if (!upcoming) return null;
    return {
      amountDue: (upcoming.amount_due ?? 0) / 100,
      currency: (upcoming.currency ?? "gbp").toLowerCase(),
      periodStart: upcoming.period_start ? new Date(upcoming.period_start * 1000).toISOString() : null,
      periodEnd: upcoming.period_end ? new Date(upcoming.period_end * 1000).toISOString() : null,
      nextPaymentAttempt: upcoming.next_payment_attempt
        ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
        : null,
    };
  } catch (err: any) {
    // No upcoming invoice (e.g. trialing, cancelled) is not an error worth logging loudly.
    if (err?.code !== "invoice_upcoming_none") {
      logger.warn({ err }, "Failed to fetch upcoming invoice");
    }
    return null;
  }
}

router.get("/v1/billing/overview", requireTenant, async (req, res): Promise<void> => {
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }

  const currency = sub.currency || PRICING.currency;
  const monthlyTotal = computeMonthlyTotal(sub.controlSeats, sub.fieldSeats, sub.tills);
  const planItems = buildPlanItems(
    { controlSeats: sub.controlSeats, fieldSeats: sub.fieldSeats, tills: sub.tills },
    currency,
  );

  let paymentMethod: SyncedPaymentMethod | null = null;
  let upcomingInvoice: Awaited<ReturnType<typeof fetchUpcomingInvoice>> = null;

  if (await isStripeConnected()) {
    const stripe = await getUncachableStripeClient();

    // Read default payment method from synced subscriptions row, or fetch live
    let defaultPmId: string | null = null;
    try {
      const r: any = await db.execute(sql`
        SELECT default_payment_method
        FROM stripe.subscriptions
        WHERE id = ${sub.stripeSubscriptionId}
        LIMIT 1
      `);
      defaultPmId = r.rows?.[0]?.default_payment_method ?? null;
    } catch (err) {
      logger.warn({ err }, "Failed to read synced subscription for default PM");
    }

    paymentMethod = await readSyncedPaymentMethod(sub.stripeCustomerId, defaultPmId);
    if (!paymentMethod) {
      paymentMethod = await fetchLivePaymentMethod(stripe, sub.stripeCustomerId, defaultPmId);
    }
    upcomingInvoice = await fetchUpcomingInvoice(stripe, sub.stripeCustomerId);
  }

  res.json(
    GetBillingOverviewResponse.parse({
      subscription: serializeSubscription(sub),
      planItems,
      currency,
      monthlyTotal,
      paymentMethod,
      upcomingInvoice,
    }),
  );
});

router.get("/v1/billing/invoices", requireTenant, async (req, res): Promise<void> => {
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }

  let invoices: Array<{
    id: string;
    number: string | null;
    status: string;
    total: number;
    currency: string;
    created: string;
    periodStart: string | null;
    periodEnd: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }> = [];

  // Prefer synced stripe.invoices; fall back to live Stripe API.
  try {
    const r: any = await db.execute(sql`
      SELECT id, number, status, total, currency, created,
             period_start, period_end, hosted_invoice_url, invoice_pdf
      FROM stripe.invoices
      WHERE customer = ${sub.stripeCustomerId}
      ORDER BY created DESC NULLS LAST
      LIMIT 25
    `);
    invoices = (r.rows ?? []).map((row: any) => ({
      id: row.id,
      number: row.number ?? null,
      status: row.status ?? "unknown",
      total: Number(row.total ?? 0) / 100,
      currency: (row.currency ?? "gbp").toLowerCase(),
      created: row.created ? new Date(Number(row.created) * 1000).toISOString() : new Date(0).toISOString(),
      periodStart: row.period_start ? new Date(Number(row.period_start) * 1000).toISOString() : null,
      periodEnd: row.period_end ? new Date(Number(row.period_end) * 1000).toISOString() : null,
      hostedInvoiceUrl: row.hosted_invoice_url ?? null,
      invoicePdf: row.invoice_pdf ?? null,
    }));
  } catch (err) {
    logger.warn({ err }, "Failed to read synced invoices");
  }

  if (invoices.length === 0 && (await isStripeConnected())) {
    try {
      const stripe = await getUncachableStripeClient();
      const live = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 25 });
      invoices = live.data.map((inv) => ({
        id: inv.id ?? "",
        number: inv.number ?? null,
        status: inv.status ?? "unknown",
        total: (inv.total ?? 0) / 100,
        currency: (inv.currency ?? "gbp").toLowerCase(),
        created: new Date((inv.created ?? 0) * 1000).toISOString(),
        periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        invoicePdf: inv.invoice_pdf ?? null,
      }));
    } catch (err) {
      logger.warn({ err }, "Failed to fetch live invoices");
    }
  }

  res.json(ListBillingInvoicesResponse.parse(invoices));
});

router.post("/v1/billing/update-payment-method", requireTenant, async (req, res): Promise<void> => {
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not connected" });
    return;
  }
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const intent = await stripe.setupIntents.create({
    customer: sub.stripeCustomerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: {
      tenant_id: sub.tenantId,
      subscription_id: sub.stripeSubscriptionId,
      purpose: "update_default_payment_method",
    },
  });
  res.json(
    CreateBillingPaymentMethodSetupResponse.parse({
      clientSecret: intent.client_secret ?? "",
      customerId: sub.stripeCustomerId,
    }),
  );
});

export default router;
