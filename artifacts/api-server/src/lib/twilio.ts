import { logger } from "./logger";

function twilioCreds(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

async function postForm(sid: string, token: string, path: string, body: Record<string, string>): Promise<any> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`;
  const form = new URLSearchParams(body);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Twilio ${path} ${resp.status}: ${text}`);
  }
  return resp.json();
}

/**
 * Send an SMS via Twilio. Returns the Twilio SID on success.
 * If no Twilio creds are present, logs the payload and returns null so callers
 * can record a `logged` delivery row without failing.
 */
export async function sendSmsViaTwilio(to: string, body: string): Promise<string | null> {
  const creds = twilioCreds();
  const from = process.env.TWILIO_SMS_FROM;
  if (!creds || !from) {
    logger.info({ to, body }, "send_sms (Twilio not configured — logged)");
    return null;
  }
  const resp = await postForm(creds.sid, creds.token, "Messages.json", { To: to, From: from, Body: body });
  return resp?.sid ?? null;
}

export async function sendWhatsAppViaTwilio(to: string, body: string): Promise<string | null> {
  const creds = twilioCreds();
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!creds || !from) {
    logger.info({ to, body }, "send_whatsapp (Twilio not configured — logged)");
    return null;
  }
  const ensurePrefix = (n: string) => (n.startsWith("whatsapp:") ? n : `whatsapp:${n}`);
  const resp = await postForm(creds.sid, creds.token, "Messages.json", {
    To: ensurePrefix(to),
    From: ensurePrefix(from),
    Body: body,
  });
  return resp?.sid ?? null;
}

/**
 * Verify a Twilio webhook signature.
 *
 * In production (`NODE_ENV === "production"`) we hard-require Twilio creds AND
 * a signature header — missing either rejects the request. Outside production
 * we allow the request through when creds are absent so local/dev testing with
 * curl works.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | undefined,
): boolean {
  const creds = twilioCreds();
  const isProd = process.env.NODE_ENV === "production";
  if (!creds) {
    if (isProd) {
      logger.error("Twilio webhook received but TWILIO_ACCOUNT_SID/AUTH_TOKEN not configured — rejecting");
      return false;
    }
    logger.warn("Twilio webhook accepted without signature verification (non-production)");
    return true;
  }
  if (!signatureHeader) return false;
  // Twilio signing: sort POST params alphabetically, append k+v to URL, HMAC-SHA1 with auth token,
  // base64-encode and compare.
  const crypto = require("crypto") as typeof import("crypto");
  const keys = Object.keys(params).sort();
  let payload = url;
  for (const k of keys) payload += k + (params[k] ?? "");
  const hmac = crypto.createHmac("sha1", creds.token).update(payload).digest("base64");
  return hmac === signatureHeader;
}
