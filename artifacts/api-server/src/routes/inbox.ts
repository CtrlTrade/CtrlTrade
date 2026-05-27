import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, customersTable, inboxThreadsTable } from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import {
  dispatchNotification,
  listMessagesForThread,
  listThreadsForTenant,
  markThreadRead,
  unreadInboxCount,
  upsertThread,
} from "../lib/notifications";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const tenantId = (req: Request) => req.auth!.tenant!.id;
const actorId = (req: Request) => req.auth!.user.id;
const actorLabel = (req: Request) => req.auth!.user.name;

router.get("/v1/inbox/threads", requireTenant, async (req, res, next) => {
  try {
    const rows = await listThreadsForTenant(tenantId(req));
    res.json({
      threads: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customerName ?? null,
        customerEmail: r.customerEmail ?? null,
        customerPhone: r.customerPhone ?? null,
        channel: r.channel,
        subject: r.subject ?? null,
        lastMessageAt: (r.lastMessageAt as Date).toISOString(),
        lastMessagePreview: r.lastMessagePreview ?? null,
        lastDirection: (r.lastDirection ?? null) as "in" | "out" | null,
        unreadCount: r.unreadCount,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/v1/inbox/unread-count", requireTenant, async (req, res, next) => {
  try {
    res.json({ count: await unreadInboxCount(tenantId(req)) });
  } catch (err) {
    next(err);
  }
});

router.get("/v1/inbox/threads/:threadId/messages", requireTenant, async (req, res, next) => {
  try {
    const msgs = await listMessagesForThread(tenantId(req), String(req.params.threadId));
    res.json({
      messages: msgs.map((m) => ({
        id: m.id,
        channel: m.channel,
        direction: m.direction as "in" | "out",
        fromAddr: m.fromAddr ?? null,
        toAddr: m.toAddr ?? null,
        subject: m.subject ?? null,
        body: m.body,
        authorLabel: m.authorLabel ?? null,
        readAt: m.readAt ? (m.readAt as Date).toISOString() : null,
        createdAt: (m.createdAt as Date).toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/v1/inbox/threads/:threadId/read", requireTenant, async (req, res, next) => {
  try {
    await markThreadRead(tenantId(req), String(req.params.threadId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/v1/inbox/threads/:threadId/reply", requireTenant, async (req, res, next): Promise<void> => {
  try {
    const t = tenantId(req);
    const body = String(req.body?.body ?? "").trim();
    const subject = req.body?.subject ? String(req.body.subject) : undefined;
    if (!body) { res.status(400).json({ error: "body required" }); return; }

    const [thread] = await db
      .select()
      .from(inboxThreadsTable)
      .where(and(eq(inboxThreadsTable.tenantId, t), eq(inboxThreadsTable.id, String(req.params.threadId))));
    if (!thread) { res.status(404).json({ error: "thread not found" }); return; }

    let to: { email?: string | null; phone?: string | null; name?: string | null; customerId?: string | null } = {
      customerId: thread.customerId,
    };
    if (thread.customerId) {
      const [c] = await db.select().from(customersTable).where(eq(customersTable.id, thread.customerId));
      if (c) to = { email: c.email, phone: c.phone, name: c.name, customerId: c.id };
    }

    const channel = (thread.channel === "portal" ? "email" : thread.channel) as "email" | "sms" | "whatsapp";
    await dispatchNotification({
      tenantId: t,
      eventKind: "inbox.reply",
      vars: { body, subject: subject ?? thread.subject ?? "" },
      channels: [channel],
      to,
      subject: subject ?? thread.subject ?? "Re: conversation",
      text: body,
      metadata: { actorUserId: actorId(req), actorLabel: actorLabel(req) },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/v1/inbox/compose", requireTenant, async (req, res, next): Promise<void> => {
  try {
    const t = tenantId(req);
    const customerId = req.body?.customerId ? String(req.body.customerId) : null;
    const channel = String(req.body?.channel ?? "email") as "email" | "sms" | "whatsapp";
    const subject = req.body?.subject ? String(req.body.subject) : "Message";
    const body = String(req.body?.body ?? "").trim();
    if (!body) { res.status(400).json({ error: "body required" }); return; }
    if (!customerId) { res.status(400).json({ error: "customerId required" }); return; }

    const [c] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, t), eq(customersTable.id, customerId)));
    if (!c) { res.status(404).json({ error: "customer not found" }); return; }

    await dispatchNotification({
      tenantId: t,
      eventKind: "inbox.compose",
      vars: { body, subject },
      channels: [channel],
      to: { email: c.email, phone: c.phone, name: c.name, customerId: c.id },
      subject,
      text: body,
      metadata: { actorUserId: actorId(req), actorLabel: actorLabel(req) },
    });

    const thread = await upsertThread(t, c.id, channel, subject);
    await logAudit({
      tenantId: t,
      actorUserId: actorId(req),
      actorLabel: actorLabel(req),
      kind: "inbox.compose",
      message: `Composed ${channel} to ${c.name}`,
      metadata: { customerId: c.id, channel },
    });
    res.json({ threadId: thread.id });
  } catch (err) {
    next(err);
  }
});

export default router;
