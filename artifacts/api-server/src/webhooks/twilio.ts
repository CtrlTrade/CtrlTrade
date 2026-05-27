import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { findCustomerByContact, recordInboundMessage } from "../lib/notifications";
import { verifyTwilioSignature } from "../lib/twilio";

/**
 * Resolve which tenant owns an inbound Twilio message by matching the `To`
 * number against tenant.phone (E.164 normalised). Falls back to the first
 * tenant only in non-production environments so dev/curl testing still works.
 *
 * Long-term this should consult a `tenant_inbound_numbers` table; see
 * `.local/tasks/task-23.md` follow-ups.
 */
async function resolveTenantForInbound(toNumber: string): Promise<string | null> {
  const norm = toNumber.replace(/^whatsapp:/, "").trim();
  if (norm) {
    const [match] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.phone, norm))
      .limit(1);
    if (match) return match.id;
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const [fallback] = await db.select({ id: tenantsTable.id }).from(tenantsTable).limit(1);
  return fallback?.id ?? null;
}

/**
 * Handle inbound Twilio messages (SMS + WhatsApp). Twilio sends the same form
 * shape for both; the `From` value is prefixed with `whatsapp:` when it's a
 * WhatsApp message.
 */
export async function handleTwilioInbound(req: Request, res: Response): Promise<void> {
  const params = (req.body ?? {}) as Record<string, string>;
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const fullUrl = `${proto}://${host}${req.originalUrl}`;
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!verifyTwilioSignature(fullUrl, params, signature)) {
    logger.warn({ url: fullUrl }, "Twilio inbound signature failed");
    res.status(403).type("text/xml").send("<Response/>");
    return;
  }

  const from = String(params["From"] ?? "");
  const to = String(params["To"] ?? "");
  const body = String(params["Body"] ?? "");
  const isWhatsApp = from.startsWith("whatsapp:") || to.startsWith("whatsapp:");
  const channel: "sms" | "whatsapp" = isWhatsApp ? "whatsapp" : "sms";
  const fromAddr = from.replace(/^whatsapp:/, "");

  const tenantId = await resolveTenantForInbound(to);
  if (!tenantId) {
    logger.warn({ to }, "Twilio inbound — no tenant matched destination number");
    res.status(200).type("text/xml").send("<Response/>");
    return;
  }

  try {
    const customer = await findCustomerByContact(tenantId, { phone: fromAddr });
    await recordInboundMessage({
      tenantId,
      customerId: customer?.id ?? null,
      channel,
      fromAddr,
      body,
      externalRef: String(params["MessageSid"] ?? "") || null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to record Twilio inbound");
  }
  // Empty TwiML so Twilio doesn't auto-reply.
  res.status(200).type("text/xml").send("<Response/>");
}
