import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync, isStripeConnected } from "./stripeClient";
import { ensurePriceIds } from "./lib/stripeSubscription";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!(await isStripeConnected())) {
    logger.warn(
      "Stripe is not connected yet. Connect via the Integrations tab. Signup/payment endpoints will return 503 until connected.",
    );
    return;
  }
  try {
    logger.info("Initializing Stripe schema");
    await runMigrations({ databaseUrl });
    const sync = await getStripeSync();
    const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (baseDomain) {
      const url = `https://${baseDomain}/api/stripe/webhook`;
      const webhook = await sync.findOrCreateManagedWebhook(url);
      logger.info(
        { webhook: webhook?.url ?? url },
        "Stripe managed webhook configured",
      );
    }
    sync
      .syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));
    await ensurePriceIds();
  } catch (err) {
    logger.error({ err }, "Stripe init failed; continuing to serve");
  }
}

initStripe().catch((err) => logger.error({ err }, "initStripe top-level error"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Listen error");
    process.exit(1);
  }
  logger.info({ port }, "API server listening");
});
