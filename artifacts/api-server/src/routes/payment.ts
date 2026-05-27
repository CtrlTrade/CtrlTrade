import { Router, type IRouter } from "express";
import { CreateSetupIntentBody, CreateSetupIntentResponse } from "@workspace/api-zod";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";

const router: IRouter = Router();

router.post("/v1/payment/setup-intent", async (req, res): Promise<void> => {
  const parsed = CreateSetupIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not connected" });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: parsed.data.email,
    name: parsed.data.companyName,
    metadata: { source: "signup-setup-intent" },
  });
  const intent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ["card"],
    usage: "off_session",
  });
  res.json(
    CreateSetupIntentResponse.parse({
      clientSecret: intent.client_secret ?? "",
      customerId: customer.id,
    }),
  );
});

export default router;
