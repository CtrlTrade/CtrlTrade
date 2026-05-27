import type Stripe from "stripe";
import { getUncachableStripeClient } from "../stripeClient";
import { PRICING } from "./pricing";
import { logger } from "./logger";

export type PriceIds = {
  controlSeat: string;
  fieldSeat: string;
  till: string;
};

let cachedPriceIds: PriceIds | null = null;

async function findOrCreateProductPrice(
  stripe: Stripe,
  productName: string,
  unitAmount: number,
): Promise<string> {
  const existing = await stripe.products.search({
    query: `active:'true' AND name:'${productName.replace(/'/g, "\\'")}'`,
  });
  let product = existing.data[0];
  if (!product) {
    product = await stripe.products.create({ name: productName });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 50 });
  const match = prices.data.find(
    (p) =>
      p.unit_amount === unitAmount &&
      p.currency === PRICING.currency &&
      p.recurring?.interval === "month",
  );
  if (match) return match.id;
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: PRICING.currency,
    recurring: { interval: "month" },
  });
  return created.id;
}

export async function ensurePriceIds(): Promise<PriceIds> {
  if (cachedPriceIds) return cachedPriceIds;
  const stripe = await getUncachableStripeClient();
  const [controlSeat, fieldSeat, till] = await Promise.all([
    findOrCreateProductPrice(stripe, PRICING.controlSeat.productName, PRICING.controlSeat.unitAmount),
    findOrCreateProductPrice(stripe, PRICING.fieldSeat.productName, PRICING.fieldSeat.unitAmount),
    findOrCreateProductPrice(stripe, PRICING.till.productName, PRICING.till.unitAmount),
  ]);
  cachedPriceIds = { controlSeat, fieldSeat, till };
  logger.info({ cachedPriceIds }, "Stripe price IDs resolved");
  return cachedPriceIds;
}

export function buildLineItems(
  quantities: { controlSeats: number; fieldSeats: number; tills: number },
  priceIds: PriceIds,
): Array<{ price: string; quantity: number }> {
  const items: Array<{ price: string; quantity: number }> = [];
  if (quantities.controlSeats > 0) items.push({ price: priceIds.controlSeat, quantity: quantities.controlSeats });
  if (quantities.fieldSeats > 0) items.push({ price: priceIds.fieldSeat, quantity: quantities.fieldSeats });
  if (quantities.tills > 0) items.push({ price: priceIds.till, quantity: quantities.tills });
  return items;
}

export function extractQuantities(
  sub: Stripe.Subscription,
  priceIds: PriceIds,
): { controlSeats: number; fieldSeats: number; tills: number } {
  let controlSeats = 0;
  let fieldSeats = 0;
  let tills = 0;
  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const qty = item.quantity ?? 0;
    if (priceId === priceIds.controlSeat) controlSeats = qty;
    else if (priceId === priceIds.fieldSeat) fieldSeats = qty;
    else if (priceId === priceIds.till) tills = qty;
  }
  return { controlSeats, fieldSeats, tills };
}
