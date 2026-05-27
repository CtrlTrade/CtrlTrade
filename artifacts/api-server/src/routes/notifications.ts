import { Router, type IRouter } from "express";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  db,
  notificationTemplatesTable,
  notificationPreferencesTable,
  notificationEventsTable,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { CHANNELS, NOTIFICATION_EVENTS } from "../lib/notifications";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/notifications/events", requireTenant, async (_req, res, next) => {
  try {
    const rows = await db.select().from(notificationEventsTable);
    const events =
      rows.length > 0
        ? rows.map((r) => ({
            kind: r.kind,
            description: r.description,
            defaultChannels: r.defaultChannels,
            category: r.category ?? null,
          }))
        : NOTIFICATION_EVENTS;
    res.json({ events, channels: CHANNELS });
  } catch (err) {
    next(err);
  }
});

router.get("/v1/notifications/preferences", requireTenant, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenant!.id;
    const userId = req.auth!.user.id;
    const rows = await db
      .select()
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.tenantId, tenantId),
          eq(notificationPreferencesTable.userId, userId),
        ),
      );
    res.json({
      preferences: rows.map((r) => ({
        eventKind: r.eventKind,
        channel: r.channel,
        enabled: r.enabled,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/v1/notifications/preferences", requireTenant, async (req, res, next): Promise<void> => {
  try {
    const tenantId = req.auth!.tenant!.id;
    const userId = req.auth!.user.id;
    const { eventKind, channel, enabled } = req.body ?? {};
    if (!eventKind || !channel) { res.status(400).json({ error: "eventKind and channel required" }); return; }
    // Use select-then-update/insert instead of onConflictDoUpdate so we don't
    // depend on a specific named unique index (the partial unique indexes
    // confuse Postgres' conflict inference when targeting columns directly).
    const existing = await db
      .select({ id: notificationPreferencesTable.id })
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.tenantId, tenantId),
          eq(notificationPreferencesTable.userId, userId),
          eq(notificationPreferencesTable.eventKind, String(eventKind)),
          eq(notificationPreferencesTable.channel, String(channel)),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(notificationPreferencesTable)
        .set({ enabled: Boolean(enabled), updatedAt: new Date() })
        .where(eq(notificationPreferencesTable.id, existing[0].id));
    } else {
      await db.insert(notificationPreferencesTable).values({
        tenantId,
        userId,
        eventKind: String(eventKind),
        channel: String(channel),
        enabled: Boolean(enabled),
      });
    }
    await logAudit({
      tenantId,
      actorUserId: userId,
      kind: "notification.preference.updated",
      message: `${eventKind}:${channel} → ${enabled ? "on" : "off"}`,
      metadata: { eventKind, channel, enabled: Boolean(enabled) },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/v1/notifications/templates", requireTenant, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenant!.id;
    const rows = await db
      .select()
      .from(notificationTemplatesTable)
      .where(
        or(
          eq(notificationTemplatesTable.tenantId, tenantId),
          isNull(notificationTemplatesTable.tenantId),
        ),
      );
    res.json({
      templates: rows.map((r) => ({
        id: r.id,
        scope: r.tenantId ? "tenant" : "global",
        eventKind: r.eventKind,
        channel: r.channel,
        subject: r.subject ?? null,
        bodyText: r.bodyText,
        bodyHtml: r.bodyHtml ?? null,
        version: r.version,
        updatedAt: (r.updatedAt as Date).toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/v1/notifications/templates", requireTenant, async (req, res, next): Promise<void> => {
  try {
    const tenantId = req.auth!.tenant!.id;
    const { eventKind, channel, subject, bodyText, bodyHtml } = req.body ?? {};
    if (!eventKind || !channel || !bodyText) {
      res.status(400).json({ error: "eventKind, channel, bodyText required" });
      return;
    }
    // Avoid onConflictDoUpdate against partial unique indexes — fetch then
    // update or insert, bumping `version` on each tenant edit so callers can
    // tell when the rendered template has changed.
    const existing = await db
      .select({ id: notificationTemplatesTable.id, version: notificationTemplatesTable.version })
      .from(notificationTemplatesTable)
      .where(
        and(
          eq(notificationTemplatesTable.tenantId, tenantId),
          eq(notificationTemplatesTable.eventKind, String(eventKind)),
          eq(notificationTemplatesTable.channel, String(channel)),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(notificationTemplatesTable)
        .set({
          subject: subject ?? null,
          bodyText: String(bodyText),
          bodyHtml: bodyHtml ?? null,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplatesTable.id, existing[0].id));
    } else {
      await db.insert(notificationTemplatesTable).values({
        tenantId,
        eventKind: String(eventKind),
        channel: String(channel),
        subject: subject ?? null,
        bodyText: String(bodyText),
        bodyHtml: bodyHtml ?? null,
      });
    }
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      kind: "notification.template.updated",
      message: `Updated template ${eventKind}/${channel}`,
      metadata: { eventKind, channel },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
