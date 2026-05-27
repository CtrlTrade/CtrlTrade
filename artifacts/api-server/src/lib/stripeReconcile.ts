import { eq } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  tenantsTable,
} from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { ensurePriceIds, extractQuantities } from "./stripeSubscription";
import { logAudit } from "./audit";
import { logger } from "./logger";

function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return stripeStatus;
  }
}

export async function reconcileFromStripeSubscription(
  stripeSubId: string,
  eventType?: string,
): Promise<void> {
  const stripe = await getUncachableStripeClient();
  const sub = await stripe.subscriptions.retrieve(stripeSubId);
  const priceIds = await ensurePriceIds();
  const q = extractQuantities(sub, priceIds);
  const status = mapStatus(sub.status);
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const currentPeriodEnd = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000)
    : null;

  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubId));

  if (!existing) {
    logger.warn({ stripeSubId }, "Subscription not found locally during reconcile");
    return;
  }

  await db
    .update(subscriptionsTable)
    .set({
      status,
      controlSeats: q.controlSeats,
      fieldSeats: q.fieldSeats,
      tills: q.tills,
      currency: sub.currency ?? "gbp",
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      lastSyncedAt: new Date(),
    })
    .where(eq(subscriptionsTable.id, existing.id));

  await db
    .update(tenantsTable)
    .set({ status, trialEndsAt })
    .where(eq(tenantsTable.id, existing.tenantId));

  if (eventType) {
    await logAudit({
      tenantId: existing.tenantId,
      actorLabel: "stripe-webhook",
      kind: eventType,
      message: `Stripe event ${eventType} applied. status=${status}`,
      metadata: { stripeSubId, q },
    });
  }
}
