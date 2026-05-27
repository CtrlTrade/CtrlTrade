import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, tenantsTable } from "@workspace/db";
import {
  GetSubscriptionResponse,
  UpdateSubscriptionQuantitiesBody,
  UpdateSubscriptionQuantitiesResponse,
  ReactivateSubscriptionResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { serializeSubscription, getTenantSubscription } from "../lib/serializers";
import { logAudit } from "../lib/audit";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { ensurePriceIds } from "../lib/stripeSubscription";
import { reconcileFromStripeSubscription } from "../lib/stripeReconcile";

const router: IRouter = Router();

router.get("/v1/subscription", requireTenant, async (req, res): Promise<void> => {
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }
  res.json(GetSubscriptionResponse.parse(serializeSubscription(sub)));
});

async function updateQuantitiesForTenant(tenantId: string, q: { controlSeats: number; fieldSeats: number; tills: number }, actor: { userId?: string; label: string }) {
  const sub = await getTenantSubscription(tenantId);
  if (!sub) throw new Error("Subscription not found");

  if (await isStripeConnected()) {
    const stripe = await getUncachableStripeClient();
    const priceIds = await ensurePriceIds();
    const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const desired: Array<{ price: string; qty: number }> = [
      { price: priceIds.controlSeat, qty: q.controlSeats },
      { price: priceIds.fieldSeat, qty: q.fieldSeats },
      { price: priceIds.till, qty: q.tills },
    ];
    const items: Stripe.SubscriptionUpdateParams.Item[] = [];
    for (const d of desired) {
      const existing = remote.items.data.find((it) => it.price.id === d.price);
      if (existing) {
        if (d.qty === 0) items.push({ id: existing.id, deleted: true });
        else items.push({ id: existing.id, quantity: d.qty });
      } else if (d.qty > 0) {
        items.push({ price: d.price, quantity: d.qty });
      }
    }
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items,
      proration_behavior: "create_prorations",
    });
    await reconcileFromStripeSubscription(sub.stripeSubscriptionId, "manual.quantity_change");
  } else {
    await db
      .update(subscriptionsTable)
      .set({
        controlSeats: q.controlSeats,
        fieldSeats: q.fieldSeats,
        tills: q.tills,
      })
      .where(eq(subscriptionsTable.id, sub.id));
  }

  await logAudit({
    tenantId,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    kind: "subscription.quantities_changed",
    message: `Quantities updated: control=${q.controlSeats} field=${q.fieldSeats} till=${q.tills}`,
    metadata: q,
  });
}

router.patch("/v1/subscription", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateSubscriptionQuantitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await updateQuantitiesForTenant(req.auth!.tenant!.id, parsed.data, {
    userId: req.auth!.user.id,
    label: req.auth!.user.email,
  });
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  res.json(UpdateSubscriptionQuantitiesResponse.parse(serializeSubscription(sub!)));
});

router.post("/v1/subscription/reactivate", requireTenant, async (req, res): Promise<void> => {
  const sub = await getTenantSubscription(req.auth!.tenant!.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }
  if (await isStripeConnected()) {
    const stripe = await getUncachableStripeClient();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await reconcileFromStripeSubscription(sub.stripeSubscriptionId, "manual.reactivate");
  } else {
    await db
      .update(subscriptionsTable)
      .set({ cancelAtPeriodEnd: false, status: "active" })
      .where(eq(subscriptionsTable.id, sub.id));
    await db
      .update(tenantsTable)
      .set({ status: "active", cancelledAt: null })
      .where(eq(tenantsTable.id, sub.tenantId));
  }
  await logAudit({
    tenantId: sub.tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "subscription.reactivated",
    message: "Subscription reactivated.",
  });
  const updated = await getTenantSubscription(req.auth!.tenant!.id);
  res.json(ReactivateSubscriptionResponse.parse(serializeSubscription(updated!)));
});

export { updateQuantitiesForTenant };
export default router;

import type Stripe from "stripe";
