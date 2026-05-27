import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { attachAuth } from "./middlewares/auth";
import { meterApiUsage } from "./middlewares/usageMeter";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS — explicit allowlist, never reflect arbitrary origins with credentials
const corsAllowlist = new Set<string>(
  [
    ...((process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean).map((d) => `https://${d.trim()}`)),
    ...((process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "",
  ].filter(Boolean),
);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / non-browser (no Origin header)
      if (!origin) return cb(null, true);
      if (corsAllowlist.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);

// Stripe webhook MUST be registered before express.json() — needs raw Buffer
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error("Webhook body not a Buffer — middleware ordering bug");
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// Twilio inbound (SMS + WhatsApp) — Twilio posts urlencoded form data and signs
// the request using the exact public URL. We parse the body ourselves so the
// shared urlencoded middleware doesn't consume it first and so we can verify
// the signature against the raw form fields.
import("./webhooks/twilio").then(({ handleTwilioInbound }) => {
  app.post(
    "/api/webhooks/twilio/inbound",
    express.urlencoded({ extended: false }),
    handleTwilioInbound,
  );
});
import("./webhooks/resend").then(({ handleResendEvent }) => {
  app.post(
    "/api/webhooks/resend/events",
    express.json({
      limit: "1mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    }),
    handleResendEvent,
  );
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Sessions via Postgres
const PgSession = connectPg(session);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for sessions");
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET is required");

app.use(
  session({
    store: new PgSession({
      conString: databaseUrl,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  }),
);

app.use(attachAuth);
app.use("/api", meterApiUsage);

app.use("/api", router);

export default app;
