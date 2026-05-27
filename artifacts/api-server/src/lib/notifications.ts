import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  db,
  notificationTemplatesTable,
  notificationPreferencesTable,
  notificationDeliveriesTable,
  inboxThreadsTable,
  inboxMessagesTable,
  customersTable,
  usersTable,
  membershipsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { logAudit } from "./audit";
import { sendEmail } from "./email";
import { sendSmsViaTwilio, sendWhatsAppViaTwilio } from "./twilio";
import { recordUsage } from "./usage";

export type Channel = "email" | "sms" | "whatsapp";

export interface NotificationEvent {
  kind: string;
  defaultChannels?: Channel[];
  description: string;
}

/** Registered notification event kinds. */
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  { kind: "team.invitation", defaultChannels: ["email"], description: "Invitation to join a workspace" },
  { kind: "auth.password_reset", defaultChannels: ["email"], description: "Password reset link" },
  { kind: "auth.signup_welcome", defaultChannels: ["email"], description: "Signup welcome email" },
  { kind: "portal.magic_link", defaultChannels: ["email"], description: "Customer portal magic link" },
  { kind: "invoice.sent", defaultChannels: ["email"], description: "Invoice sent to customer" },
  { kind: "invoice.payment.receipt", defaultChannels: ["email"], description: "Payment receipt for paid invoice" },
  { kind: "invoice.overdue", defaultChannels: ["email"], description: "Invoice overdue reminder" },
  { kind: "quote.sent", defaultChannels: ["email"], description: "Quote sent to customer" },
  { kind: "quote.accepted", defaultChannels: ["email"], description: "Quote acceptance receipt" },
  { kind: "job.scheduled", defaultChannels: ["email", "sms"], description: "Job scheduled — customer notice" },
  { kind: "job.engineer_on_way", defaultChannels: ["sms"], description: "Engineer en-route" },
  { kind: "compliance_expiry_digest", defaultChannels: ["email"], description: "Daily compliance/MOT/tax digest" },
  { kind: "inbox.new_message", defaultChannels: ["email"], description: "New inbound customer message" },
];

export const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

/** Mustache-lite: replace {{key}} or {{nested.key}} with stringified value. */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const parts = path.split(".");
    let v: any = vars;
    for (const p of parts) {
      if (v == null) return "";
      v = v[p];
    }
    return v == null ? "" : String(v);
  });
}

interface ResolvedTemplate {
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
}

export async function resolveTemplate(
  tenantId: string | null,
  eventKind: string,
  channel: Channel,
): Promise<ResolvedTemplate | null> {
  // Tenant override first, then global default.
  const rows = await db
    .select()
    .from(notificationTemplatesTable)
    .where(
      and(
        eq(notificationTemplatesTable.eventKind, eventKind),
        eq(notificationTemplatesTable.channel, channel),
        tenantId
          ? or(eq(notificationTemplatesTable.tenantId, tenantId), isNull(notificationTemplatesTable.tenantId))
          : isNull(notificationTemplatesTable.tenantId),
      ),
    );
  if (rows.length === 0) return null;
  // Prefer tenant-specific row if present.
  rows.sort((a, b) => (a.tenantId ? -1 : 1) - (b.tenantId ? -1 : 1));
  const row = rows[0];
  return { subject: row.subject, bodyText: row.bodyText, bodyHtml: row.bodyHtml };
}

export interface DispatchInput {
  tenantId: string;
  eventKind: string;
  vars: Record<string, unknown>;
  /** Override channels — defaults to event registration. */
  channels?: Channel[];
  /** Direct recipient (used for transactional sends that don't go to users). */
  to?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    customerId?: string | null;
  };
  /** Target tenant users (filtered by their preferences). */
  recipientUserIds?: string[];
  /** Subject override (skips template subject). */
  subject?: string;
  /** Plain-text body override (skips template render). */
  text?: string;
  /** HTML body override. */
  html?: string;
  /** Optional inbox thread linkage. */
  subjectKind?: string;
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  deliveries: number;
  channels: Channel[];
}

async function getUserPrefs(
  tenantId: string,
  userId: string,
  eventKind: string,
): Promise<Record<Channel, boolean>> {
  const rows = await db
    .select()
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.tenantId, tenantId),
        eq(notificationPreferencesTable.userId, userId),
        eq(notificationPreferencesTable.eventKind, eventKind),
      ),
    );
  const out: Record<Channel, boolean> = { email: true, sms: false, whatsapp: false };
  for (const r of rows) {
    if ((CHANNELS as string[]).includes(r.channel)) out[r.channel as Channel] = r.enabled;
  }
  return out;
}

/**
 * Centralised notification dispatcher. Resolves the right template per channel,
 * renders it with `vars`, persists a `notification_deliveries` row, and routes
 * via the appropriate adapter. Also writes an audit log entry and optionally
 * appends to a customer inbox thread.
 */
export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const ev = NOTIFICATION_EVENTS.find((e) => e.kind === input.eventKind);
  const channels = input.channels ?? ev?.defaultChannels ?? ["email"];

  let total = 0;
  const used: Channel[] = [];

  for (const ch of channels) {
    // Resolve template (subject + body) or fall back to caller-provided overrides.
    const tpl = await resolveTemplate(input.tenantId, input.eventKind, ch);
    const subject = input.subject ?? (tpl?.subject ? renderTemplate(tpl.subject, input.vars) : undefined);
    const text = input.text ?? (tpl ? renderTemplate(tpl.bodyText, input.vars) : null);
    const html = input.html ?? (tpl?.bodyHtml ? renderTemplate(tpl.bodyHtml, input.vars) : undefined);
    if (!text) {
      logger.warn(
        { tenantId: input.tenantId, eventKind: input.eventKind, channel: ch },
        "dispatchNotification: no template and no body — skipping channel",
      );
      continue;
    }

    if (ch === "email") {
      // Resolve email recipients.
      const recipients: Array<{ email: string; name?: string }> = [];
      if (input.to?.email) {
        recipients.push({ email: input.to.email, name: input.to.name ?? undefined });
      }
      if (input.recipientUserIds?.length) {
        const users = await db
          .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .where(sql`${usersTable.id} = ANY(${input.recipientUserIds})`);
        for (const u of users) {
          const prefs = await getUserPrefs(input.tenantId, u.id, input.eventKind);
          if (prefs.email && u.email) recipients.push({ email: u.email, name: u.name ?? undefined });
        }
      }
      if (recipients.length === 0) continue;
      await sendEmail({
        tenantId: input.tenantId,
        template: input.eventKind,
        to: recipients,
        subject: subject ?? "(no subject)",
        text,
        html,
        metadata: input.metadata,
      });
      total += recipients.length;
      used.push("email");
      await maybeAppendInbox(input, ch, recipients.map((r) => r.email).join(","), subject ?? "", text);
      continue;
    }

    if (ch === "sms" || ch === "whatsapp") {
      // SMS/WhatsApp targets a phone number provided by the caller (e.g.
      // customer contact). Internal users don't have phone numbers in this
      // schema, so we don't fan out to recipientUserIds for these channels.
      const numbers: string[] = [];
      if (input.to?.phone) numbers.push(input.to.phone);
      if (numbers.length === 0) continue;
      for (const to of numbers) {
        const [delivery] = await db
          .insert(notificationDeliveriesTable)
          .values({
            tenantId: input.tenantId,
            channel: ch,
            template: input.eventKind,
            subject: subject ?? null,
            payload: { to, text, html, metadata: input.metadata ?? null },
            status: "queued",
          })
          .returning();
        try {
          let externalRef: string | null = null;
          if (ch === "sms") externalRef = await sendSmsViaTwilio(to, text);
          if (ch === "whatsapp") externalRef = await sendWhatsAppViaTwilio(to, text);
          await db
            .update(notificationDeliveriesTable)
            .set({ status: externalRef ? "sent" : "logged" })
            .where(eq(notificationDeliveriesTable.id, delivery.id));
          await recordUsage(input.tenantId, ch === "sms" ? "sms" : "whatsapp", 1, { to });
          await maybeAppendInbox(input, ch, to, subject ?? "", text, delivery.id, externalRef);
        } catch (err) {
          await db
            .update(notificationDeliveriesTable)
            .set({
              status: "failed",
              payload: { to, text, error: String(err), metadata: input.metadata ?? null },
            })
            .where(eq(notificationDeliveriesTable.id, delivery.id));
          logger.error({ err, channel: ch, eventKind: input.eventKind }, "Notification delivery failed");
        }
        total++;
      }
      used.push(ch);
    }
  }

  await logAudit({
    tenantId: input.tenantId,
    kind: "notification.sent",
    message: `${input.eventKind} dispatched on ${used.join(",") || "(no channel)"} (${total} recipients)`,
    metadata: { eventKind: input.eventKind, channels: used, recipients: total, ...(input.metadata ?? {}) },
  });

  return { deliveries: total, channels: used };
}

async function maybeAppendInbox(
  input: DispatchInput,
  channel: Channel,
  toAddr: string,
  subject: string,
  body: string,
  deliveryId?: string,
  externalRef?: string | null,
): Promise<void> {
  const customerId = input.to?.customerId ?? null;
  if (!customerId) return;
  const thread = await upsertThread(input.tenantId, customerId, channel, subject || input.eventKind);
  await db.insert(inboxMessagesTable).values({
    tenantId: input.tenantId,
    threadId: thread.id,
    channel,
    direction: "out",
    fromAddr: null,
    toAddr,
    subject: subject || null,
    body,
    deliveryId: deliveryId ?? null,
    externalRef: externalRef ?? null,
    authorLabel: "System",
  });
  await db
    .update(inboxThreadsTable)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 140),
      lastDirection: "out",
    })
    .where(eq(inboxThreadsTable.id, thread.id));
}

export async function upsertThread(
  tenantId: string,
  customerId: string | null,
  channel: string,
  subject: string,
): Promise<{ id: string }> {
  if (customerId) {
    const [existing] = await db
      .select({ id: inboxThreadsTable.id })
      .from(inboxThreadsTable)
      .where(
        and(
          eq(inboxThreadsTable.tenantId, tenantId),
          eq(inboxThreadsTable.customerId, customerId),
          eq(inboxThreadsTable.channel, channel),
        ),
      );
    if (existing) return existing;
  }
  const [row] = await db
    .insert(inboxThreadsTable)
    .values({ tenantId, customerId, channel, subject })
    .returning({ id: inboxThreadsTable.id });
  return row;
}

/** Find an existing customer by email or phone; used by inbound webhooks. */
export async function findCustomerByContact(
  tenantId: string,
  opts: { email?: string | null; phone?: string | null },
): Promise<{ id: string; name: string } | null> {
  if (opts.email) {
    const [c] = await db
      .select({ id: customersTable.id, name: customersTable.name })
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.email, opts.email)));
    if (c) return c;
  }
  if (opts.phone) {
    const normalize = (p: string) => p.replace(/[^\d+]/g, "");
    const want = normalize(opts.phone);
    // Postgres doesn't have a built-in normaliser; do an in-memory match scan
    // over the tenant's customers — usually small enough for transactional use.
    const list = await db
      .select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone })
      .from(customersTable)
      .where(eq(customersTable.tenantId, tenantId));
    const hit = list.find((c) => c.phone && normalize(c.phone) === want);
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

/** Append an inbound message and bump thread counters. */
export async function recordInboundMessage(opts: {
  tenantId: string;
  customerId: string | null;
  channel: Channel;
  fromAddr: string;
  body: string;
  subject?: string | null;
  externalRef?: string | null;
}): Promise<void> {
  const thread = await upsertThread(
    opts.tenantId,
    opts.customerId,
    opts.channel,
    opts.subject ?? `${opts.channel} conversation`,
  );
  await db.insert(inboxMessagesTable).values({
    tenantId: opts.tenantId,
    threadId: thread.id,
    channel: opts.channel,
    direction: "in",
    fromAddr: opts.fromAddr,
    toAddr: null,
    subject: opts.subject ?? null,
    body: opts.body,
    externalRef: opts.externalRef ?? null,
    authorLabel: opts.fromAddr,
  });
  await db
    .update(inboxThreadsTable)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: opts.body.slice(0, 140),
      lastDirection: "in",
      unreadCount: sql`${inboxThreadsTable.unreadCount} + 1`,
    })
    .where(eq(inboxThreadsTable.id, thread.id));

  await logAudit({
    tenantId: opts.tenantId,
    kind: "inbox.message.received",
    message: `Inbound ${opts.channel} from ${opts.fromAddr}`,
    metadata: { channel: opts.channel, fromAddr: opts.fromAddr, customerId: opts.customerId ?? null },
  });

  // Notify all tenant owners/admins of new inbound message via their pref.
  try {
    const owners = await db
      .select({ userId: membershipsTable.userId })
      .from(membershipsTable)
      .where(
        and(eq(membershipsTable.tenantId, opts.tenantId), sql`${membershipsTable.role} in ('owner','admin')`),
      );
    if (owners.length > 0) {
      await dispatchNotification({
        tenantId: opts.tenantId,
        eventKind: "inbox.new_message",
        vars: { fromAddr: opts.fromAddr, channel: opts.channel, body: opts.body.slice(0, 200) },
        recipientUserIds: owners.map((o) => o.userId),
      });
    }
  } catch (err) {
    logger.warn({ err }, "inbox.new_message notify failed");
  }
}

/** Seed global default templates. Idempotent — runs on every boot. */
export async function seedDefaultTemplates(): Promise<void> {
  const defaults: Array<{
    eventKind: string;
    channel: Channel;
    subject?: string;
    bodyText: string;
    bodyHtml?: string;
  }> = [
    {
      eventKind: "team.invitation",
      channel: "email",
      subject: "You've been invited to {{tenantName}} on CtrlTrade®",
      bodyText:
        "{{inviterName}} invited you to join {{tenantName}} on CtrlTrade®.\n\nAccept your invitation:\n{{acceptUrl}}\n\nThis link expires in 7 days.\n",
    },
    {
      eventKind: "auth.password_reset",
      channel: "email",
      subject: "Reset your CtrlTrade® password",
      bodyText:
        "Hi {{name}},\n\nReset your password:\n{{resetUrl}}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n",
    },
    {
      eventKind: "auth.signup_welcome",
      channel: "email",
      subject: "Welcome to CtrlTrade® — let's get you set up",
      bodyText:
        "Hi {{name}},\n\nWelcome to CtrlTrade®! Your workspace {{tenantName}} is ready.\n\nSign in: {{appUrl}}\n",
    },
    {
      eventKind: "portal.magic_link",
      channel: "email",
      subject: "Sign in to {{tenantName}}",
      bodyText: "Hi {{customerName}},\n\nSign in to your {{tenantName}} portal:\n{{magicUrl}}\n\nThis link expires in 24 hours.\n",
    },
    {
      eventKind: "invoice.sent",
      channel: "email",
      subject: "Invoice {{invoiceNumber}} from {{tenantName}}",
      bodyText:
        "Hi {{customerName}},\n\nYour invoice {{invoiceNumber}} for {{amount}} is ready.\n\nPay online:\n{{paymentUrl}}\n\nThank you,\n{{tenantName}}\n",
    },
    {
      eventKind: "invoice.payment.receipt",
      channel: "email",
      subject: "Payment received — invoice {{invoiceNumber}}",
      bodyText:
        "Hi {{customerName}},\n\nThanks — we've received your payment of {{amount}} for invoice {{invoiceNumber}}.\n\n{{tenantName}}\n",
    },
    {
      eventKind: "invoice.overdue",
      channel: "email",
      subject: "Reminder: invoice {{invoiceNumber}} is overdue",
      bodyText:
        "Hi {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amount}} is now overdue.\n\nPay online:\n{{paymentUrl}}\n\n{{tenantName}}\n",
    },
    {
      eventKind: "quote.sent",
      channel: "email",
      subject: "Quote {{quoteNumber}} from {{tenantName}}",
      bodyText: "Hi {{customerName}},\n\nYour quote {{quoteNumber}} is ready to review.\n\n{{quoteUrl}}\n\n{{tenantName}}\n",
    },
    {
      eventKind: "quote.accepted",
      channel: "email",
      subject: "Quote {{quoteNumber}} accepted",
      bodyText: "Hi {{customerName}},\n\nThanks for accepting quote {{quoteNumber}}. We'll be in touch shortly to schedule the work.\n\n{{tenantName}}\n",
    },
    {
      eventKind: "job.scheduled",
      channel: "email",
      subject: "Your appointment with {{tenantName}}",
      bodyText: "Hi {{customerName}},\n\nYour job is scheduled for {{scheduledAt}}.\n\nReference: {{jobNumber}}\n\n{{tenantName}}\n",
    },
    {
      eventKind: "job.scheduled",
      channel: "sms",
      bodyText: "{{tenantName}}: your appointment is booked for {{scheduledAt}}. Ref {{jobNumber}}.",
    },
    {
      eventKind: "job.engineer_on_way",
      channel: "sms",
      bodyText: "{{tenantName}}: {{engineerName}} is on the way and should arrive at approximately {{eta}}.",
    },
    {
      eventKind: "compliance_expiry_digest",
      channel: "email",
      subject: "{{tenantName}}: {{expiredCount}} expired, {{expiringCount}} expiring",
      bodyText: "Compliance digest for {{tenantName}}:\n\n{{summary}}\n",
    },
    {
      eventKind: "inbox.new_message",
      channel: "email",
      subject: "New message from {{fromAddr}}",
      bodyText: "You have a new {{channel}} message from {{fromAddr}}:\n\n{{body}}\n\nReview in your inbox.\n",
    },
  ];

  for (const tpl of defaults) {
    await db
      .insert(notificationTemplatesTable)
      .values({
        tenantId: null,
        eventKind: tpl.eventKind,
        channel: tpl.channel,
        subject: tpl.subject ?? null,
        bodyText: tpl.bodyText,
        bodyHtml: tpl.bodyHtml ?? null,
      })
      .onConflictDoNothing();
  }
  logger.info({ count: defaults.length }, "Notification templates seeded");
}

export async function listThreadsForTenant(tenantId: string, limit = 100) {
  const rows = await db
    .select({
      id: inboxThreadsTable.id,
      customerId: inboxThreadsTable.customerId,
      channel: inboxThreadsTable.channel,
      subject: inboxThreadsTable.subject,
      lastMessageAt: inboxThreadsTable.lastMessageAt,
      lastMessagePreview: inboxThreadsTable.lastMessagePreview,
      lastDirection: inboxThreadsTable.lastDirection,
      unreadCount: inboxThreadsTable.unreadCount,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      customerPhone: customersTable.phone,
    })
    .from(inboxThreadsTable)
    .leftJoin(customersTable, eq(customersTable.id, inboxThreadsTable.customerId))
    .where(eq(inboxThreadsTable.tenantId, tenantId))
    .orderBy(desc(inboxThreadsTable.lastMessageAt))
    .limit(limit);
  return rows;
}

export async function listMessagesForThread(tenantId: string, threadId: string) {
  const rows = await db
    .select()
    .from(inboxMessagesTable)
    .where(and(eq(inboxMessagesTable.tenantId, tenantId), eq(inboxMessagesTable.threadId, threadId)))
    .orderBy(asc(inboxMessagesTable.createdAt));
  return rows;
}

export async function markThreadRead(tenantId: string, threadId: string): Promise<void> {
  const now = new Date();
  await db
    .update(inboxMessagesTable)
    .set({ readAt: now })
    .where(
      and(
        eq(inboxMessagesTable.tenantId, tenantId),
        eq(inboxMessagesTable.threadId, threadId),
        isNull(inboxMessagesTable.readAt),
      ),
    );
  await db
    .update(inboxThreadsTable)
    .set({ unreadCount: 0 })
    .where(and(eq(inboxThreadsTable.tenantId, tenantId), eq(inboxThreadsTable.id, threadId)));
}

export async function unreadInboxCount(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${inboxThreadsTable.unreadCount}), 0)::int` })
    .from(inboxThreadsTable)
    .where(eq(inboxThreadsTable.tenantId, tenantId));
  return Number(row?.n ?? 0);
}
