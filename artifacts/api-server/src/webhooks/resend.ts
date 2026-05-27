import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, notificationDeliveriesTable, tenantsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { findCustomerByContact, recordInboundMessage } from "../lib/notifications";

/**
 * Verify a Resend webhook signature using the Svix headers Resend sends
 * (`svix-id`, `svix-timestamp`, `svix-signature`). Production hard-requires
 * `RESEND_WEBHOOK_SECRET`; outside production a missing secret allows the
 * request through (for local curl testing) but is logged as a warning.
 */
function verifyResendSignature(req: Request, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (!secret) {
    if (isProd) {
      logger.error("Resend webhook received but RESEND_WEBHOOK_SECRET not configured — rejecting");
      return false;
    }
    logger.warn("Resend webhook accepted without signature verification (non-production)");
    return true;
  }
  const id = req.headers["svix-id"] as string | undefined;
  const ts = req.headers["svix-timestamp"] as string | undefined;
  const sigHeader = req.headers["svix-signature"] as string | undefined;
  if (!id || !ts || !sigHeader) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  const crypto = require("crypto") as typeof import("crypto");
  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const payload = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(payload).digest("base64");
  const provided = sigHeader.split(" ").map((p) => p.split(",")[1]).filter(Boolean);
  for (const p of provided) {
    if (p.length === expected.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

const DELIVERY_STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

async function updateDeliveryStatus(providerMessageId: string, status: string): Promise<void> {
  if (!providerMessageId) return;
  await db
    .update(notificationDeliveriesTable)
    .set({ status })
    .where(eq(notificationDeliveriesTable.providerMessageId, providerMessageId));
}

/**
 * Resolve a tenant for an inbound email. Prefer matching against a configured
 * inbound mailbox per tenant (TODO: dedicated table); fall back to the only
 * tenant in dev. Production hard-rejects with no match.
 */
async function resolveTenantForInboundEmail(toAddrs: string[]): Promise<{ id: string } | null> {
  const isProd = process.env.NODE_ENV === "production";
  // For now match on tenant slug appearing in any recipient's local-part
  // (e.g. acme+inbox@inbound.ctrltrade.com routes to tenant slug "acme").
  for (const to of toAddrs) {
    const local = String(to).split("@")[0]?.split("+")[0]?.toLowerCase();
    if (!local) continue;
    const [t] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, local));
    if (t) return t;
  }
  if (!isProd) {
    const [first] = await db.select({ id: tenantsTable.id }).from(tenantsTable).limit(1);
    if (first) {
      logger.warn({ toAddrs }, "Resend inbound: no tenant match, dev-fallback to first tenant");
      return first;
    }
  }
  return null;
}

/**
 * Handle Resend events:
 *   - delivery events (email.sent / delivered / bounced / complained / opened
 *     / clicked) → update notification_deliveries.status by provider_message_id
 *   - inbound events (email.received / email.inbound) → write to inbox_threads
 *     via recordInboundMessage, resolving the tenant + customer from the
 *     recipient/sender addresses.
 */
export async function handleResendEvent(req: Request, res: Response): Promise<void> {
  const rawBody = (req as any).rawBody as string | undefined;
  if (!rawBody) {
    res.status(400).json({ error: "raw body missing" });
    return;
  }
  if (!verifyResendSignature(req, rawBody)) {
    logger.warn("Resend webhook signature verification failed");
    res.status(403).json({ error: "bad signature" });
    return;
  }
  const evt = req.body ?? {};
  const type = String(evt.type ?? "");
  const data = evt.data ?? {};

  if (type === "email.received" || type === "email.inbound") {
    try {
      const toAddrs: string[] = Array.isArray(data.to) ? data.to : data.to ? [String(data.to)] : [];
      const fromAddr = String(data.from ?? data.from_email ?? "").trim();
      const subject = data.subject ? String(data.subject) : null;
      const body = String(data.text ?? data.html ?? "").trim();
      const externalRef = String(data.email_id ?? data.id ?? "") || null;
      const tenant = await resolveTenantForInboundEmail(toAddrs);
      if (!tenant) {
        logger.warn({ toAddrs, fromAddr }, "Resend inbound: no tenant match — dropping");
        res.status(202).json({ ok: true, ignored: "no tenant match" });
        return;
      }
      const customer = await findCustomerByContact(tenant.id, { email: fromAddr });
      await recordInboundMessage({
        tenantId: tenant.id,
        customerId: customer?.id ?? null,
        channel: "email",
        fromAddr: fromAddr || "(unknown)",
        body,
        subject,
        externalRef,
      });
      res.json({ ok: true });
      return;
    } catch (err) {
      logger.error({ err }, "Resend inbound processing failed");
      res.status(500).json({ error: "inbound processing failed" });
      return;
    }
  }

  const mappedStatus = DELIVERY_STATUS_MAP[type];
  if (mappedStatus) {
    const providerId = String(data.email_id ?? data.id ?? "");
    if (providerId) await updateDeliveryStatus(providerId, mappedStatus);
  }
  logger.info({ type, id: data.email_id ?? data.id }, "Resend webhook event");
  res.json({ ok: true });
}
