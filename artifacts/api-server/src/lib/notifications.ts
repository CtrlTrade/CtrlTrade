import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  notificationTemplatesTable,
  notificationPreferencesTable,
  notificationDeliveriesTable,
  notificationEventsTable,
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
  category?: string;
}

/** Registered notification event kinds. Mirrored into notification_events at boot. */
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  { kind: "team.invitation", defaultChannels: ["email"], description: "Invitation to join a workspace", category: "team" },
  { kind: "auth.password_reset", defaultChannels: ["email"], description: "Password reset link", category: "auth" },
  { kind: "auth.signup_welcome", defaultChannels: ["email"], description: "Signup welcome email", category: "auth" },
  { kind: "portal.magic_link", defaultChannels: ["email"], description: "Customer portal magic link", category: "portal" },
  { kind: "invoice.sent", defaultChannels: ["email"], description: "Invoice sent to customer", category: "invoice" },
  { kind: "invoice.payment.receipt", defaultChannels: ["email"], description: "Payment receipt for paid invoice", category: "invoice" },
  { kind: "invoice.overdue", defaultChannels: ["email"], description: "Invoice overdue reminder", category: "invoice" },
  { kind: "quote.sent", defaultChannels: ["email"], description: "Quote sent to customer", category: "quote" },
  { kind: "quote.accepted", defaultChannels: ["email"], description: "Quote acceptance receipt", category: "quote" },
  { kind: "job.scheduled", defaultChannels: ["email", "sms"], description: "Job scheduled — customer notice", category: "job" },
  { kind: "job.engineer_on_way", defaultChannels: ["sms"], description: "Engineer en-route", category: "job" },
  { kind: "compliance_expiry_digest", defaultChannels: ["email"], description: "Daily compliance/MOT/tax digest", category: "compliance" },
  { kind: "inbox.new_message", defaultChannels: ["email"], description: "New inbound customer message", category: "inbox" },
  { kind: "inbox.reply", defaultChannels: ["email"], description: "Operator reply on a thread", category: "inbox" },
  { kind: "inbox.compose", defaultChannels: ["email"], description: "Operator-initiated message to a customer", category: "inbox" },
  { kind: "contract.expiry_warning", defaultChannels: ["email"], description: "Maintenance contract expiring in 7 days", category: "contract" },
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
  rows.sort((a, b) => (a.tenantId ? -1 : 1) - (b.tenantId ? -1 : 1));
  const row = rows[0];
  return { subject: row.subject, bodyText: row.bodyText, bodyHtml: row.bodyHtml };
}

export interface DispatchInput {
  tenantId: string;
  eventKind: string;
  vars: Record<string, unknown>;
  channels?: Channel[];
  to?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    customerId?: string | null;
  };
  recipientUserIds?: string[];
  subject?: string;
  text?: string;
  html?: string;
  subjectKind?: string;
  subjectId?: string | null;
  /** Link the dispatched message to a job for thread-by-job inbox grouping. */
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  deliveries: number;
  channels: Channel[];
}

type PrefFrequency = "immediate" | "digest_daily" | "digest_weekly";
type ChannelPref = { enabled: boolean; frequency: PrefFrequency };

async function getUserPrefsFull(
  tenantId: string,
  userId: string,
  eventKind: string,
): Promise<Record<Channel, ChannelPref>> {
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
  const out: Record<Channel, ChannelPref> = {
    email: { enabled: true, frequency: "immediate" },
    sms: { enabled: false, frequency: "immediate" },
    whatsapp: { enabled: false, frequency: "immediate" },
  };
  for (const r of rows) {
    if (!(CHANNELS as string[]).includes(r.channel)) continue;
    out[r.channel as Channel] = {
      enabled: r.enabled,
      frequency: (((r as any).frequency ?? "immediate") as PrefFrequency),
    };
  }
  return out;
}

async function enqueueDigestDelivery(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  eventKind: string;
  channel: Channel;
  subject: string | null;
  text: string;
  html?: string | null;
  frequency: PrefFrequency;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(notificationDeliveriesTable).values({
    tenantId: args.tenantId,
    channel: args.channel,
    template: args.eventKind,
    subject: args.subject,
    jobId: args.jobId ?? null,
    payload: {
      to: { email: args.userEmail, name: args.userName },
      userId: args.userId,
      subject: args.subject,
      text: args.text,
      html: args.html ?? null,
      frequency: args.frequency,
      eventKind: args.eventKind,
      metadata: args.metadata ?? null,
    },
    status: "deferred",
    attemptCount: 0,
  });
}

/**
 * Aggregate deferred deliveries for the given digest cadence into one summary
 * email per user. Marks consumed rows as `sent` once dispatched. Called by
 * `notification_digest_daily` and `notification_digest_weekly` cron jobs.
 */
export async function processDigests(frequency: PrefFrequency): Promise<{ users: number; items: number }> {
  if (frequency === "immediate") return { users: 0, items: 0 };
  const rows = await db
    .select()
    .from(notificationDeliveriesTable)
    .where(
      and(
        eq(notificationDeliveriesTable.status, "deferred"),
        sql`${notificationDeliveriesTable.payload}->>'frequency' = ${frequency}`,
      ),
    )
    .limit(2000);

  // Group by (tenantId, userId, userEmail)
  const groups = new Map<string, { tenantId: string; email: string; name: string | null; items: any[] }>();
  for (const r of rows) {
    const p = (r.payload ?? {}) as any;
    const email = p?.to?.email;
    const userId = p?.userId ?? "anon";
    if (!email) continue;
    const key = `${r.tenantId}::${userId}::${email}`;
    if (!groups.has(key)) {
      groups.set(key, { tenantId: r.tenantId, email, name: p?.to?.name ?? null, items: [] });
    }
    groups.get(key)!.items.push({ id: r.id, eventKind: p.eventKind, subject: p.subject, text: p.text, createdAt: r.createdAt });
  }

  let usersSent = 0;
  let itemsSent = 0;
  for (const g of groups.values()) {
    const subject = `CtrlTrade® ${frequency === "digest_daily" ? "daily" : "weekly"} digest — ${g.items.length} update${g.items.length === 1 ? "" : "s"}`;
    const text = g.items
      .map((it) => `• [${it.eventKind}] ${it.subject ?? "(no subject)"}\n${it.text}\n`)
      .join("\n---\n");
    try {
      await sendEmail({
        tenantId: g.tenantId,
        template: `digest.${frequency}`,
        to: [{ email: g.email, name: g.name ?? undefined }],
        subject,
        text,
        metadata: { digest: frequency, count: g.items.length },
      });
      await db
        .update(notificationDeliveriesTable)
        .set({ status: "sent" })
        .where(inArray(notificationDeliveriesTable.id, g.items.map((i) => i.id)));
      usersSent++;
      itemsSent += g.items.length;
    } catch (err) {
      logger.error({ err, email: g.email, frequency }, "Digest send failed");
    }
  }
  return { users: usersSent, items: itemsSent };
}

const RETRY_BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60];
const MAX_DELIVERY_ATTEMPTS = RETRY_BACKOFF_SECONDS.length + 1;

export function nextRetryDelaySeconds(attemptCount: number): number | null {
  if (attemptCount >= MAX_DELIVERY_ATTEMPTS) return null;
  return RETRY_BACKOFF_SECONDS[Math.min(attemptCount - 1, RETRY_BACKOFF_SECONDS.length - 1)] ?? null;
}

/**
 * Sweep failed notification_deliveries rows whose next_retry_at is due and
 * re-attempt them. Bounded per-tick so a flood of failures doesn't lock the
 * worker. Called from the `notification_retry` cron job.
 */
export async function processDeliveryRetries(limit = 50): Promise<{ retried: number; succeeded: number }> {
  const due = await db
    .select()
    .from(notificationDeliveriesTable)
    .where(
      and(
        eq(notificationDeliveriesTable.status, "failed"),
        lte(notificationDeliveriesTable.nextRetryAt, new Date()),
      ),
    )
    .limit(limit);

  let succeeded = 0;
  for (const row of due) {
    const payload = (row.payload as Record<string, any>) ?? {};
    try {
      if (row.channel === "email") {
        // Re-send through the email path; sendEmail will update this row by id.
        await sendEmail({
          tenantId: row.tenantId,
          template: row.template,
          to: payload.to ?? [],
          subject: row.subject ?? payload.subject ?? "(no subject)",
          text: payload.text ?? "",
          html: payload.html ?? undefined,
          metadata: payload.metadata ?? undefined,
          _retryDeliveryId: row.id,
        });
        succeeded++;
      } else if (row.channel === "sms" || row.channel === "whatsapp") {
        const fn = row.channel === "sms" ? sendSmsViaTwilio : sendWhatsAppViaTwilio;
        const externalRef = await fn(payload.to, payload.text);
        await db
          .update(notificationDeliveriesTable)
          .set({
            status: externalRef ? "sent" : "logged",
            providerMessageId: externalRef ?? null,
            lastError: null,
            nextRetryAt: null,
            attemptCount: (row.attemptCount ?? 0) + 1,
          })
          .where(eq(notificationDeliveriesTable.id, row.id));
        succeeded++;
      }
    } catch (err) {
      const nextAttempt = (row.attemptCount ?? 0) + 1;
      const delay = nextRetryDelaySeconds(nextAttempt);
      await db
        .update(notificationDeliveriesTable)
        .set({
          status: delay == null ? "dead" : "failed",
          attemptCount: nextAttempt,
          lastError: String(err).slice(0, 500),
          nextRetryAt: delay == null ? null : new Date(Date.now() + delay * 1000),
        })
        .where(eq(notificationDeliveriesTable.id, row.id));
    }
  }
  return { retried: due.length, succeeded };
}

/**
 * Centralised notification dispatcher. Resolves the right template per channel,
 * renders it with `vars`, persists a `notification_deliveries` row, and routes
 * via the appropriate adapter. Writes an audit-log entry and optionally appends
 * to a customer/job inbox thread. Failed sends are scheduled for retry.
 */
export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const ev = NOTIFICATION_EVENTS.find((e) => e.kind === input.eventKind);
  const channels = input.channels ?? ev?.defaultChannels ?? ["email"];

  let total = 0;
  const used: Channel[] = [];

  for (const ch of channels) {
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
          if (!u.email) continue;
          const prefs = await getUserPrefsFull(input.tenantId, u.id, input.eventKind);
          const p = prefs.email;
          if (!p.enabled) continue;
          if (p.frequency === "immediate") {
            recipients.push({ email: u.email, name: u.name ?? undefined });
          } else {
            await enqueueDigestDelivery({
              tenantId: input.tenantId,
              userId: u.id,
              userEmail: u.email,
              userName: u.name,
              eventKind: input.eventKind,
              channel: "email",
              subject: subject ?? null,
              text,
              html: html ?? null,
              frequency: p.frequency,
              jobId: input.jobId ?? null,
              metadata: input.metadata,
            });
          }
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
        jobId: input.jobId ?? null,
      });
      total += recipients.length;
      used.push("email");
      await maybeAppendInbox(input, ch, recipients.map((r) => r.email).join(","), subject ?? "", text);
      continue;
    }

    if (ch === "sms" || ch === "whatsapp") {
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
            jobId: input.jobId ?? null,
            payload: { to, text, html, metadata: input.metadata ?? null },
            status: "queued",
            attemptCount: 1,
          })
          .returning();
        try {
          let externalRef: string | null = null;
          if (ch === "sms") externalRef = await sendSmsViaTwilio(to, text);
          if (ch === "whatsapp") externalRef = await sendWhatsAppViaTwilio(to, text);
          await db
            .update(notificationDeliveriesTable)
            .set({ status: externalRef ? "sent" : "logged", providerMessageId: externalRef ?? null })
            .where(eq(notificationDeliveriesTable.id, delivery.id));
          await recordUsage(input.tenantId, ch === "sms" ? "sms" : "whatsapp", 1, { to });
          await maybeAppendInbox(input, ch, to, subject ?? "", text, delivery.id, externalRef);
        } catch (err) {
          const delay = nextRetryDelaySeconds(1);
          await db
            .update(notificationDeliveriesTable)
            .set({
              status: "failed",
              lastError: String(err).slice(0, 500),
              nextRetryAt: delay == null ? null : new Date(Date.now() + delay * 1000),
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
  const jobId = input.jobId ?? null;
  if (!customerId && !jobId) return;
  const thread = await upsertThread(input.tenantId, customerId, channel, subject || input.eventKind, jobId);
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
  jobId: string | null = null,
): Promise<{ id: string }> {
  if (customerId || jobId) {
    const conds = [
      eq(inboxThreadsTable.tenantId, tenantId),
      eq(inboxThreadsTable.channel, channel),
      customerId ? eq(inboxThreadsTable.customerId, customerId) : isNull(inboxThreadsTable.customerId),
      jobId ? eq(inboxThreadsTable.jobId, jobId) : isNull(inboxThreadsTable.jobId),
    ];
    const [existing] = await db
      .select({ id: inboxThreadsTable.id })
      .from(inboxThreadsTable)
      .where(and(...conds));
    if (existing) return existing;
  }
  const [row] = await db
    .insert(inboxThreadsTable)
    .values({ tenantId, customerId, jobId, channel, subject })
    .returning({ id: inboxThreadsTable.id });
  return row;
}

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
  jobId?: string | null;
}): Promise<void> {
  const thread = await upsertThread(
    opts.tenantId,
    opts.customerId,
    opts.channel,
    opts.subject ?? `${opts.channel} conversation`,
    opts.jobId ?? null,
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

/** Seed global default templates and the event registry. Idempotent. */
export async function seedDefaultTemplates(): Promise<void> {
  // Seed event registry from constant.
  for (const ev of NOTIFICATION_EVENTS) {
    await db
      .insert(notificationEventsTable)
      .values({
        kind: ev.kind,
        description: ev.description,
        defaultChannels: ev.defaultChannels ?? [],
        category: ev.category ?? null,
      })
      .onConflictDoUpdate({
        target: notificationEventsTable.kind,
        set: {
          description: ev.description,
          defaultChannels: ev.defaultChannels ?? [],
          category: ev.category ?? null,
          updatedAt: new Date(),
        },
      });
  }

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
        "Hi {{customerName}},\n\nThanks — we've received your payment of {{amount}} for invoice {{invoiceNumber}}.{{fullyPaidLine}}\n\n{{tenantName}}\n",
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
    {
      eventKind: "inbox.reply",
      channel: "email",
      subject: "{{subject}}",
      bodyText: "{{body}}\n",
    },
    {
      eventKind: "inbox.compose",
      channel: "email",
      subject: "{{subject}}",
      bodyText: "{{body}}\n",
    },
    {
      eventKind: "inbox.reply",
      channel: "sms",
      bodyText: "{{body}}",
    },
    {
      eventKind: "inbox.compose",
      channel: "sms",
      bodyText: "{{body}}",
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
  logger.info({ events: NOTIFICATION_EVENTS.length, templates: defaults.length }, "Notification events + templates seeded");
}

export async function listThreadsForTenant(tenantId: string, limit = 100) {
  const rows = await db
    .select({
      id: inboxThreadsTable.id,
      customerId: inboxThreadsTable.customerId,
      jobId: inboxThreadsTable.jobId,
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
