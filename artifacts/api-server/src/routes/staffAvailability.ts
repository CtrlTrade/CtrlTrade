import { Router, type IRouter } from "express";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  staffAvailabilityTable,
  usersTable,
  membershipsTable,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { dispatchNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_REASONS = new Set(["holiday", "sick", "training", "other"]);

const AvailabilityInput = z.object({
  userId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string(),
  notes: z.string().nullable().optional(),
});

const AvailabilityQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  userId: z.string().uuid().optional(),
});

function serialize(
  row: typeof staffAvailabilityTable.$inferSelect,
  userName: string | null,
) {
  return {
    id: row.id,
    userId: row.userId,
    userName,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /v1/staff/availability
router.get("/v1/staff/availability", requireTenant, async (req, res): Promise<void> => {
  const parsed = AvailabilityQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const { from, to, userId } = parsed.data;

  const conditions = [eq(staffAvailabilityTable.tenantId, tenantId)];
  if (userId) conditions.push(eq(staffAvailabilityTable.userId, userId));
  if (from) {
    conditions.push(gte(staffAvailabilityTable.endDate, from));
  }
  if (to) {
    conditions.push(lte(staffAvailabilityTable.startDate, to));
  }

  const rows = await db
    .select({
      a: staffAvailabilityTable,
      userName: usersTable.name,
    })
    .from(staffAvailabilityTable)
    .leftJoin(usersTable, eq(usersTable.id, staffAvailabilityTable.userId))
    .where(and(...conditions))
    .orderBy(staffAvailabilityTable.startDate);

  res.json(rows.map((r) => serialize(r.a, r.userName ?? null)));
});

// POST /v1/staff/availability
router.post("/v1/staff/availability", requireTenant, async (req, res): Promise<void> => {
  const parsed = AvailabilityInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const actorId = req.auth!.user.id;
  const actorRole = req.auth!.membership?.role ?? "staff";

  const { userId, startDate, endDate, reason, notes } = parsed.data;

  if (startDate > endDate) {
    res.status(400).json({ error: "startDate must be before or equal to endDate" });
    return;
  }
  if (!VALID_REASONS.has(reason)) {
    res.status(400).json({ error: "reason must be one of: holiday, sick, training, other" });
    return;
  }

  // Staff can only submit for themselves; managers/admins/owners can submit for anyone on their tenant
  const canManageOthers = ["owner", "admin", "manager"].includes(actorRole);
  if (!canManageOthers && userId !== actorId) {
    res.status(403).json({ error: "Staff may only submit availability for themselves" });
    return;
  }

  // Verify target user is a member of this tenant
  const [membership] = await db
    .select({ userId: membershipsTable.userId })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
  if (!membership) {
    res.status(404).json({ error: "User not found in this tenant" });
    return;
  }

  const [row] = await db
    .insert(staffAvailabilityTable)
    .values({ tenantId, userId, startDate, endDate, reason, notes: notes ?? null, createdByUserId: actorId })
    .returning();

  const [userRow] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  await logAudit({
    tenantId,
    actorUserId: actorId,
    actorLabel: req.auth!.user.email,
    kind: "staff.availability.created",
    message: `Availability block created for ${userRow?.name ?? userId}: ${startDate}–${endDate} (${reason})`,
    metadata: { availabilityId: row.id, userId, startDate, endDate, reason },
  });

  // Notify managers/owners
  try {
    const managers = await db
      .select({ userId: membershipsTable.userId })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.tenantId, tenantId),
          eq(membershipsTable.status, "active"),
        ),
      );
    const notifyIds = managers
      .filter((m) => m.userId !== actorId)
      .map((m) => m.userId);
    if (notifyIds.length > 0) {
      await dispatchNotification({
        tenantId,
        eventKind: "staff.availability.submitted",
        vars: {
          staffName: userRow?.name ?? userId,
          startDate,
          endDate,
          reason,
        },
        recipientUserIds: notifyIds,
        subject: `Staff availability: ${userRow?.name ?? userId} – ${reason}`,
        text: `${userRow?.name ?? userId} is unavailable from ${startDate} to ${endDate} (${reason}).`,
      });
    }
  } catch (err) {
    logger.warn({ err }, "staff.availability.submitted notify failed");
  }

  res.status(201).json(serialize(row, userRow?.name ?? null));
});

// DELETE /v1/staff/availability/:id
router.delete("/v1/staff/availability/:id", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const actorId = req.auth!.user.id;
  const actorRole = req.auth!.membership?.role ?? "staff";
  const id = String(req.params.id);

  const [row] = await db
    .select()
    .from(staffAvailabilityTable)
    .where(and(eq(staffAvailabilityTable.id, id), eq(staffAvailabilityTable.tenantId, tenantId)));

  if (!row) {
    res.status(404).json({ error: "Availability block not found" });
    return;
  }

  const canManageOthers = ["owner", "admin", "manager"].includes(actorRole);
  if (!canManageOthers && row.userId !== actorId) {
    res.status(403).json({ error: "Staff may only delete their own availability blocks" });
    return;
  }

  await db
    .delete(staffAvailabilityTable)
    .where(eq(staffAvailabilityTable.id, id));

  await logAudit({
    tenantId,
    actorUserId: actorId,
    actorLabel: req.auth!.user.email,
    kind: "staff.availability.deleted",
    message: `Availability block deleted: ${row.startDate}–${row.endDate} for ${row.userId}`,
    metadata: { availabilityId: id, userId: row.userId },
  });

  res.status(204).end();
});

export default router;
