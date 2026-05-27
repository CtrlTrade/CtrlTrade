import { Router, type IRouter } from "express";
import { PRICING } from "../lib/pricing";
import {
  GetPricingResponse,
  ListTradeCategoriesResponse,
} from "@workspace/api-zod";
import { db, tradeCategoriesTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import { getStripePublishableKey, isStripeConnected } from "../stripeClient";

const router: IRouter = Router();

router.get("/v1/stripe/publishable-key", async (_req, res): Promise<void> => {
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not connected" });
    return;
  }
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err: any) {
    res.status(503).json({ error: err?.message ?? "Stripe unavailable" });
  }
});

router.get("/v1/pricing", (_req, res) => {
  const body = GetPricingResponse.parse({
    currency: PRICING.currency,
    trialDays: PRICING.trialDays,
    controlSeat: {
      name: PRICING.controlSeat.name,
      amount: PRICING.controlSeat.amount,
      currency: PRICING.currency,
      interval: PRICING.controlSeat.interval,
      features: [...PRICING.controlSeat.features],
    },
    fieldSeat: {
      name: PRICING.fieldSeat.name,
      amount: PRICING.fieldSeat.amount,
      currency: PRICING.currency,
      interval: PRICING.fieldSeat.interval,
      features: [...PRICING.fieldSeat.features],
    },
    till: {
      name: PRICING.till.name,
      amount: PRICING.till.amount,
      currency: PRICING.currency,
      interval: PRICING.till.interval,
      features: [...PRICING.till.features],
    },
  });
  res.json(body);
});

router.get("/v1/trade-categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tradeCategoriesTable)
    .orderBy(asc(tradeCategoriesTable.sortOrder));
  res.json(
    ListTradeCategoriesResponse.parse(
      rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        jobTypes: r.jobTypes ?? [],
      })),
    ),
  );
});

export default router;
