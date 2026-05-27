import type { Request, Response } from "express";
import { logger } from "../lib/logger";

/**
 * Verify a Resend webhook signature using the Svix headers Resend sends
 * (`svix-id`, `svix-timestamp`, `svix-signature`). The HMAC payload is
 * `${svix-id}.${svix-timestamp}.${rawBody}` signed with the webhook secret
 * (base64-decoded) using HMAC-SHA256, base64-encoded, and compared against the
 * `v1,<signature>` portion of `svix-signature`.
 *
 * Production hard-requires `RESEND_WEBHOOK_SECRET`; outside production a
 * missing secret allows the request through (for local curl testing) but is
 * logged as a warning.
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
  // Replay-window check: 5 minutes either side.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  const crypto = require("crypto") as typeof import("crypto");
  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const payload = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(payload).digest("base64");
  // sigHeader format: "v1,<sig> v1,<sig2>" — any match counts.
  const provided = sigHeader.split(" ").map((p) => p.split(",")[1]).filter(Boolean);
  for (const p of provided) {
    if (p.length === expected.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/**
 * Handle Resend delivery events (delivered, bounced, opened, complained, etc).
 * For now this only logs validated events — provider-id-to-delivery mapping
 * lives in lib/email.ts (TODO: persist Resend id on send).
 */
export async function handleResendEvent(req: Request, res: Response): Promise<void> {
  // We need the raw body for signature verification; the route mounts a JSON
  // parser with `verify` that stashes it on req.
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
  logger.info({ type, id: data.email_id ?? data.id }, "Resend webhook event");
  res.json({ ok: true });
}
