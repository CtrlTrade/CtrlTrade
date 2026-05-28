import { Router, type IRouter } from "express";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, tenantIntegrationsTable, leadsTable } from "@workspace/db";
import { decryptToken } from "../lib/tokenCrypt";
import { logger } from "../lib/logger";
import { logAudit } from "../lib/audit";
import { recordSync } from "../lib/integrations/sync";
import { requireTenant } from "../middlewares/auth";
import type { ExternalLead } from "../lib/integrations/types";

const router: IRouter = Router();

const LEAD_PROVIDERS = ["myjobquote", "checkatrade"] as const;
type LeadProvider = (typeof LEAD_PROVIDERS)[number];

function isLeadProvider(s: string): s is LeadProvider {
  return (LEAD_PROVIDERS as readonly string[]).includes(s);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** Map a raw webhook payload to ExternalLead — handles both MJQ and Checkatrade shapes. */
function mapWebhookPayload(
  provider: LeadProvider,
  raw: Record<string, unknown>,
): ExternalLead | null {
  const externalId = String(
    raw["id"] ??
      raw["lead_id"] ??
      raw["enquiry_id"] ??
      raw["reference"] ??
      "",
  );
  if (!externalId) return null;

  const name = String(
    raw["customer_name"] ??
      raw["consumer_name"] ??
      raw["name"] ??
      "Unknown",
  );

  const email = raw["email"] ? String(raw["email"]) : null;
  const phone = raw["phone"] ?? raw["telephone"]
    ? String(raw["phone"] ?? raw["telephone"])
    : null;
  const addressLine1 = raw["address_line_1"] ?? raw["address"]
    ? String(raw["address_line_1"] ?? raw["address"])
    : null;
  const postcode = raw["postcode"] ? String(raw["postcode"]) : null;
  const description = raw["description"] ?? raw["job_description"]
    ? String(raw["description"] ?? raw["job_description"])
    : null;

  const budgetRaw = Number(
    raw["budget"] ??
      raw["budget_amount"] ??
      raw["estimated_value"] ??
      0,
  );

  const rawDate =
    raw["created_at"] ?? raw["submitted_at"] ?? raw["posted_at"];
  const postedAt = rawDate ? new Date(String(rawDate)) : new Date();

  return {
    externalId,
    name,
    email,
    phone,
    addressLine1,
    postcode,
    description,
    budgetPence: Math.round(budgetRaw * 100),
    postedAt,
  };
}

/**
 * Receive a real-time lead push from MyJobQuote or Checkatrade.
 *
 * URL:     POST /v1/webhooks/leads/:provider/:tenantId
 * Auth:    X-Webhook-Secret header — must match the secret stored in
 *          tenantIntegrations.settings.webhookSecret for the tenant+provider.
 *
 * The platform should be configured to send POST requests to:
 *   https://<domain>/api/v1/webhooks/leads/<provider>/<tenantId>
 * with the header  X-Webhook-Secret: <secret from the connect response>.
 *
 * Returns 200 on success (including duplicates), 401 on bad secret, 422 on
 * unprocessable payload.  Always returns quickly so the platform does not retry
 * unnecessarily; any processing error is logged but still returns 200 so the
 * platform does not flood us with retries for non-transient errors.
 */
router.post(
  "/v1/webhooks/leads/:provider/:tenantId",
  async (req, res): Promise<void> => {
    const { provider: providerParam, tenantId } = req.params as {
      provider: string;
      tenantId: string;
    };

    if (!isLeadProvider(providerParam)) {
      res.status(404).json({ error: "Unknown provider" });
      return;
    }
    const provider = providerParam;

    const incomingSecret =
      (req.headers["x-webhook-secret"] as string | undefined) ?? "";

    // Load the integration row for this tenant + provider.
    const [integ] = await db
      .select()
      .from(tenantIntegrationsTable)
      .where(
        and(
          eq(tenantIntegrationsTable.tenantId, tenantId),
          eq(tenantIntegrationsTable.provider, provider),
        ),
      );

    if (!integ || integ.status !== "connected") {
      // Return 401 rather than 404 so we don't reveal tenant existence.
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const settings = (integ.settings ?? {}) as Record<string, unknown>;
    const storedSecret = (settings["webhookSecret"] as string | undefined) ?? "";

    if (!storedSecret || !timingSafeStringEqual(incomingSecret, storedSecret)) {
      logger.warn({ tenantId, provider }, "leads.webhook: bad webhook secret");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(422).json({ error: "Invalid payload" });
      return;
    }

    // Some platforms wrap the payload; unwrap if needed.
    const raw: Record<string, unknown> =
      body["lead"] && typeof body["lead"] === "object"
        ? (body["lead"] as Record<string, unknown>)
        : body["enquiry"] && typeof body["enquiry"] === "object"
          ? (body["enquiry"] as Record<string, unknown>)
          : body;

    const ext = mapWebhookPayload(provider, raw);
    if (!ext) {
      logger.warn({ tenantId, provider, body }, "leads.webhook: missing externalId in payload");
      res.status(422).json({ error: "Missing lead id in payload" });
      return;
    }

    try {
      // Dedup check — same logic as the poll-based import.
      const [existing] = await db
        .select({ id: leadsTable.id })
        .from(leadsTable)
        .where(
          and(
            eq(leadsTable.tenantId, tenantId),
            eq(leadsTable.source, provider),
            eq(leadsTable.externalId, ext.externalId),
          ),
        );

      if (existing) {
        logger.debug(
          { tenantId, provider, externalId: ext.externalId },
          "leads.webhook: duplicate — skipped",
        );
        res.json({ imported: false, reason: "duplicate" });
        return;
      }

      const providerLabel =
        provider === "myjobquote" ? "MyJobQuote" : "Checkatrade";

      await db.insert(leadsTable).values({
        tenantId,
        name: ext.name,
        email: ext.email,
        phone: ext.phone,
        source: provider,
        sourceDetail: ext.externalId,
        externalId: ext.externalId,
        title: ext.description
          ? ext.description.slice(0, 120)
          : `${providerLabel} enquiry`,
        message: ext.description,
        valuePence: ext.budgetPence,
        score: 0,
        status: "new",
        followUpDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await recordSync({
        tenantId,
        provider,
        direction: "pull",
        entityKind: "lead",
        status: "ok",
        message: `Webhook: imported lead ${ext.externalId} from ${providerLabel}`,
        metadata: { externalId: ext.externalId, via: "webhook" },
      });

      await logAudit({
        tenantId,
        kind: "lead.imported",
        actorLabel: `webhook:${provider}`,
        message: `Lead imported via ${providerLabel} webhook (${ext.externalId})`,
        metadata: { externalId: ext.externalId, provider },
      });

      logger.info(
        { tenantId, provider, externalId: ext.externalId },
        "leads.webhook: imported",
      );

      res.json({ imported: true });
    } catch (err) {
      // Log but still return 200 — non-transient errors should not trigger
      // platform retries that would flood the endpoint.
      logger.error({ err, tenantId, provider }, "leads.webhook: insert failed");
      await recordSync({
        tenantId,
        provider,
        direction: "pull",
        entityKind: "lead",
        status: "error",
        message: err instanceof Error ? err.message.slice(0, 500) : String(err),
        metadata: { externalId: ext.externalId, via: "webhook" },
      }).catch(() => {});
      res.json({ imported: false, reason: "error" });
    }
  },
);

/**
 * Return the webhook URL and (hashed display) secret for a connected provider.
 * Used by the settings UI to show the webhook configuration instructions.
 */
router.get(
  "/v1/integrations/:provider/webhook-info",
  requireTenant,
  async (req, res): Promise<void> => {
    const { provider } = req.params as { provider: string };
    if (!isLeadProvider(provider)) {
      res.status(404).json({ error: "Not a lead-import provider" });
      return;
    }

    const tenantId = req.auth!.tenant!.id;
    const [integ] = await db
      .select()
      .from(tenantIntegrationsTable)
      .where(
        and(
          eq(tenantIntegrationsTable.tenantId, tenantId),
          eq(tenantIntegrationsTable.provider, provider),
        ),
      );

    if (!integ || integ.status !== "connected") {
      res.status(404).json({ error: "Integration not connected" });
      return;
    }

    const _apiKey = decryptToken(integ.accessTokenEnc);
    const settings = (integ.settings ?? {}) as Record<string, unknown>;
    const webhookSecret = (settings["webhookSecret"] as string | undefined) ?? null;

    // Build the webhook URL using the same domain logic as the embed snippet.
    const baseDomain =
      process.env.REPLIT_DOMAINS?.split(",")[0] ??
      process.env.REPLIT_DEV_DOMAIN ??
      "your-app.replit.app";
    const webhookUrl = `https://${baseDomain}/api/v1/webhooks/leads/${provider}/${tenantId}`;

    res.json({
      webhookUrl,
      webhookSecret,
      hasApiKey: Boolean(_apiKey),
    });
  },
);

/** Generate or rotate the webhook secret for a lead-import integration. */
router.post(
  "/v1/integrations/:provider/webhook-secret/rotate",
  requireTenant,
  async (req, res): Promise<void> => {
    const { provider } = req.params as { provider: string };
    if (!isLeadProvider(provider)) {
      res.status(404).json({ error: "Not a lead-import provider" });
      return;
    }

    const tenantId = req.auth!.tenant!.id;
    const [integ] = await db
      .select()
      .from(tenantIntegrationsTable)
      .where(
        and(
          eq(tenantIntegrationsTable.tenantId, tenantId),
          eq(tenantIntegrationsTable.provider, provider),
        ),
      );

    if (!integ || integ.status !== "connected") {
      res.status(404).json({ error: "Integration not connected" });
      return;
    }

    const settings = (integ.settings ?? {}) as Record<string, unknown>;
    const newSecret = randomBytes(32).toString("hex");

    await db
      .update(tenantIntegrationsTable)
      .set({ settings: { ...settings, webhookSecret: newSecret } })
      .where(eq(tenantIntegrationsTable.id, integ.id));

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      kind: "integration.webhook_secret_rotated",
      message: `Webhook secret rotated for ${provider}`,
      metadata: { provider },
    });

    const baseDomain =
      process.env.REPLIT_DOMAINS?.split(",")[0] ??
      process.env.REPLIT_DEV_DOMAIN ??
      "your-app.replit.app";
    const webhookUrl = `https://${baseDomain}/api/v1/webhooks/leads/${provider}/${tenantId}`;

    res.json({ webhookUrl, webhookSecret: newSecret });
  },
);

export default router;
