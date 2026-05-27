import { db, notificationDeliveriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface SendEmailInput {
  tenantId: string;
  template: string;
  to: Array<{ email: string; name?: string }>;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export function getAppBaseUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return process.env.APP_BASE_URL ?? "";
}

async function deliverViaSendGrid(input: SendEmailInput, apiKey: string): Promise<void> {
  const from = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? "CtrlTrade";
  if (!from) {
    throw new Error("EMAIL_FROM_ADDRESS is required when SENDGRID_API_KEY is set");
  }
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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`SendGrid responded ${resp.status}: ${text}`);
  }
}

/**
 * Send an email and record the delivery. Records into the existing
 * `notification_deliveries` table (single source of truth) and then attempts
 * real delivery if a transport is configured via env (currently SendGrid).
 * If no transport is configured, the row stays in `logged` state — readable
 * from the same table by a future drain worker — and we log the payload.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (input.to.length === 0) {
    logger.warn({ tenantId: input.tenantId, template: input.template }, "sendEmail called with no recipients");
    return;
  }
  const [row] = await db
    .insert(notificationDeliveriesTable)
    .values({
      tenantId: input.tenantId,
      channel: "email",
      template: input.template,
      status: "queued",
      payload: {
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? null,
        metadata: input.metadata ?? null,
      },
    })
    .returning();

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "logged" })
      .where(eq(notificationDeliveriesTable.id, row.id));
    logger.info(
      {
        tenantId: input.tenantId,
        template: input.template,
        recipients: input.to.map((r) => r.email),
        subject: input.subject,
        deliveryId: row.id,
      },
      "Email logged (no transport configured — set SENDGRID_API_KEY + EMAIL_FROM_ADDRESS to deliver)",
    );
    return;
  }

  try {
    await deliverViaSendGrid(input, sendgridKey);
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "sent" })
      .where(eq(notificationDeliveriesTable.id, row.id));
    logger.info(
      {
        tenantId: input.tenantId,
        template: input.template,
        recipients: input.to.map((r) => r.email),
        deliveryId: row.id,
      },
      "Email sent via SendGrid",
    );
  } catch (err) {
    await db
      .update(notificationDeliveriesTable)
      .set({ status: "failed", payload: { ...(row.payload as Record<string, unknown>), error: String(err) } })
      .where(eq(notificationDeliveriesTable.id, row.id));
    logger.error({ err, tenantId: input.tenantId, template: input.template }, "Email delivery failed");
    throw err;
  }
}
