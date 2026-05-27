import { db, notificationDeliveriesTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { recordUsage } from "./usage";
import { nextRetryDelaySeconds } from "./notifications";

export interface SendEmailInput {
  tenantId: string;
  template: string;
  to: Array<{ email: string; name?: string }>;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
  jobId?: string | null;
  /** Internal: when set, update this delivery row instead of inserting a new one (retry path). */
  _retryDeliveryId?: string;
}

/**
 * Resolve the "from" address/name for a tenant. White-labelled tenants
 * with `outboundFromEmail` configured send from their own brand; everyone
 * else falls back to the platform-wide EMAIL_FROM_ADDRESS / EMAIL_FROM_NAME.
 */
async function resolveFromIdentity(tenantId: string): Promise<{ email: string | null; name: string }> {
  const platformFrom = process.env.EMAIL_FROM_ADDRESS ?? null;
  const platformName = process.env.EMAIL_FROM_NAME ?? "CtrlTrade";
  try {
    const [t] = await db
      .select({ wl: tenantsTable.whiteLabelConfig, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!t) return { email: platformFrom, name: platformName };
    const wl = (t.wl ?? {}) as Record<string, unknown>;
    const wlFrom = typeof wl.outboundFromEmail === "string" ? wl.outboundFromEmail.trim() : "";
    const wlFromName = typeof wl.outboundFromName === "string" ? wl.outboundFromName.trim() : "";
    const hideBranding = wl.hideCtrlTradeBranding === true;
    if (wlFrom) {
      return { email: wlFrom, name: wlFromName || t.name };
    }
    if (hideBranding) {
      // Strip CtrlTrade branding from the sender name even if no custom address
      // is configured yet (still uses platform from-address).
      return { email: platformFrom, name: wlFromName || t.name };
    }
    return { email: platformFrom, name: platformName };
  } catch {
    return { email: platformFrom, name: platformName };
  }
}

export function getAppBaseUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return process.env.APP_BASE_URL ?? "";
}

async function deliverViaResend(input: SendEmailInput, apiKey: string): Promise<{ id: string | null }> {
  const from = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? "CtrlTrade";
  if (!from) throw new Error("EMAIL_FROM_ADDRESS is required when RESEND_API_KEY is set");
  const body = {
    from: `${fromName} <${from}>`,
    to: input.to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Resend responded ${resp.status}: ${text}`);
  }
  const json = (await resp.json().catch(() => ({}))) as { id?: string };
  return { id: json.id ?? null };
}

async function deliverViaSendGrid(input: SendEmailInput, apiKey: string): Promise<{ id: string | null }> {
  const identity = await resolveFromIdentity(input.tenantId);
  const from = identity.email;
  const fromName = identity.name;
  if (!from) throw new Error("EMAIL_FROM_ADDRESS is required when SENDGRID_API_KEY is set");
  const body = {
    personalizations: [
      {
        to: input.to.map((r) => ({ email: r.email, ...(r.name ? { name: r.name } : {}) })),
        subject: input.subject,
      },
    ],
    from: { email: from, name: fromName },
    content: [
      { type: "text/plain", value: input.text },
      ...(input.html ? [{ type: "text/html", value: input.html }] : []),
    ],
  };
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`SendGrid responded ${resp.status}: ${text}`);
  }
  return { id: (resp.headers.get("x-message-id") ?? null) as string | null };
}

/**
 * Send an email and record the delivery. Persists into `notification_deliveries`
 * (single source of truth), then attempts delivery via Resend > SendGrid by
 * env. On failure, schedules a retry by setting `next_retry_at` with backoff
 * (the worker's `notification_retry` cron sweeps and re-attempts due rows).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (input.to.length === 0) {
    logger.warn({ tenantId: input.tenantId, template: input.template }, "sendEmail called with no recipients");
    return;
  }

  let rowId: string;
  let attemptCount: number;
  if (input._retryDeliveryId) {
    rowId = input._retryDeliveryId;
    const [existing] = await db
      .select({ attemptCount: notificationDeliveriesTable.attemptCount })
      .from(notificationDeliveriesTable)
      .where(eq(notificationDeliveriesTable.id, rowId));
    attemptCount = (existing?.attemptCount ?? 0) + 1;
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "queued", attemptCount, lastError: null, nextRetryAt: null })
      .where(eq(notificationDeliveriesTable.id, rowId));
  } else {
    const [row] = await db
      .insert(notificationDeliveriesTable)
      .values({
        tenantId: input.tenantId,
        channel: "email",
        template: input.template,
        status: "queued",
        subject: input.subject,
        jobId: input.jobId ?? null,
        attemptCount: 1,
        payload: {
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html ?? null,
          metadata: input.metadata ?? null,
        },
      })
      .returning({ id: notificationDeliveriesTable.id });
    rowId = row.id;
    attemptCount = 1;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const transport: "resend" | "sendgrid" | null = resendKey ? "resend" : sendgridKey ? "sendgrid" : null;
  if (!transport) {
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "logged" })
      .where(eq(notificationDeliveriesTable.id, rowId));
    logger.info(
      {
        tenantId: input.tenantId,
        template: input.template,
        recipients: input.to.map((r) => r.email),
        subject: input.subject,
        deliveryId: rowId,
      },
      "Email logged (no transport — set RESEND_API_KEY or SENDGRID_API_KEY + EMAIL_FROM_ADDRESS to deliver)",
    );
    return;
  }

  try {
    const { id: providerId } =
      transport === "resend" ? await deliverViaResend(input, resendKey!) : await deliverViaSendGrid(input, sendgridKey!);
    void recordUsage(input.tenantId, "email", input.to.length, { template: input.template });
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "sent", providerMessageId: providerId, lastError: null, nextRetryAt: null })
      .where(eq(notificationDeliveriesTable.id, rowId));
    logger.info(
      { tenantId: input.tenantId, template: input.template, recipients: input.to.map((r) => r.email), deliveryId: rowId, providerId, transport },
      "Email sent",
    );
  } catch (err) {
    const delay = nextRetryDelaySeconds(attemptCount);
    const nextRetryAt = delay == null ? null : new Date(Date.now() + delay * 1000);
    await db
      .update(notificationDeliveriesTable)
      .set({
        status: delay == null ? "dead" : "failed",
        lastError: String(err).slice(0, 500),
        nextRetryAt,
      })
      .where(eq(notificationDeliveriesTable.id, rowId));
    logger.error({ err, tenantId: input.tenantId, template: input.template, attemptCount, retryAt: nextRetryAt }, "Email delivery failed");
    // Don't throw on retryable failures — caller doesn't need to know.
    if (delay == null) throw err;
  }
}
