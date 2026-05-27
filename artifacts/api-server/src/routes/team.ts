import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, isNull, gt, count } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  membershipsTable,
  usersTable,
  invitationsTable,
  passwordResetTokensTable,
  subscriptionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  InviteTeamMemberBody,
  UpdateMemberBody,
} from "@workspace/api-zod";
import { requireRole, requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { sendEmail, getAppBaseUrl } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ROLES = new Set(["owner", "admin", "manager", "staff"]);
const SEAT_TYPES = new Set(["control", "field"]);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SeatUsage {
  controlSeatsUsed: number;
  controlSeatsLimit: number;
  fieldSeatsUsed: number;
  fieldSeatsLimit: number;
  tillsLimit: number;
}

export class SeatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function computeSeatUsage(tenantId: string, dbx: DbLike = db): Promise<SeatUsage> {
  const [sub] = await dbx
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.tenantId, tenantId));
  const activeMembers = await dbx
    .select({ seatType: membershipsTable.seatType })
    .from(membershipsTable)
    .where(
      and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.status, "active")),
    );
  const pendingInvites = await dbx
    .select({ seatType: invitationsTable.seatType })
    .from(invitationsTable)
    .where(
      and(
        eq(invitationsTable.tenantId, tenantId),
        isNull(invitationsTable.acceptedAt),
        isNull(invitationsTable.revokedAt),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    );
  let controlUsed = 0;
  let fieldUsed = 0;
  for (const m of [...activeMembers, ...pendingInvites]) {
    if (m.seatType === "control") controlUsed++;
    else if (m.seatType === "field") fieldUsed++;
  }
  return {
    controlSeatsUsed: controlUsed,
    controlSeatsLimit: sub?.controlSeats ?? 0,
    fieldSeatsUsed: fieldUsed,
    fieldSeatsLimit: sub?.fieldSeats ?? 0,
    tillsLimit: sub?.tills ?? 0,
  };
}

async function loadOverview(tenantId: string, currentUserId: string) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const members = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      lastLoginAt: usersTable.lastLoginAt,
      role: membershipsTable.role,
      seatType: membershipsTable.seatType,
      status: membershipsTable.status,
      invitedAt: membershipsTable.invitedAt,
      disabledAt: membershipsTable.disabledAt,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(eq(membershipsTable.tenantId, tenantId))
    .orderBy(membershipsTable.createdAt);

  const invitations = await db
    .select({
      id: invitationsTable.id,
      email: invitationsTable.email,
      role: invitationsTable.role,
      seatType: invitationsTable.seatType,
      expiresAt: invitationsTable.expiresAt,
      createdAt: invitationsTable.createdAt,
      invitedByEmail: usersTable.email,
    })
    .from(invitationsTable)
    .leftJoin(usersTable, eq(usersTable.id, invitationsTable.invitedByUserId))
    .where(
      and(
        eq(invitationsTable.tenantId, tenantId),
        isNull(invitationsTable.acceptedAt),
        isNull(invitationsTable.revokedAt),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitationsTable.createdAt));

  const usage = await computeSeatUsage(tenantId);

  return ({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      seatType: m.seatType,
      status: m.status,
      isYou: m.userId === currentUserId,
      invitedAt: m.invitedAt?.toISOString() ?? null,
      disabledAt: m.disabledAt?.toISOString() ?? null,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      seatType: i.seatType,
      invitedByLabel: i.invitedByEmail ?? null,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
      acceptUrl: null,
    })),
    seatUsage: usage,
  });
}

router.get("/v1/team", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  res.json(await loadOverview(tenantId, req.auth!.user.id));
});

router.get("/v1/team/seat-usage", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  res.json((await computeSeatUsage(tenantId)));
});

router.post(
  "/v1/team/invitations",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = InviteTeamMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const tenantName = req.auth!.tenant!.name;
    const role = parsed.data.role;
    const seatType = parsed.data.seatType;
    if (!ROLES.has(role) || role === "owner") {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (!SEAT_TYPES.has(seatType)) {
      res.status(400).json({ error: "Invalid seat type" });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let inv;
    try {
      inv = await db.transaction(async (tx) => {
        // Lock the subscription row so concurrent invites serialize on it.
        await tx
          .select({ id: subscriptionsTable.id })
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.tenantId, tenantId))
          .for("update");

        const existingMember = await tx
          .select({ status: membershipsTable.status })
          .from(membershipsTable)
          .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
          .where(and(eq(membershipsTable.tenantId, tenantId), eq(usersTable.email, email)));
        if (existingMember.some((m) => m.status === "active")) {
          throw new SeatError(409, "User is already a member of this tenant");
        }

        const usage = await computeSeatUsage(tenantId, tx);
        if (seatType === "control" && usage.controlSeatsUsed >= usage.controlSeatsLimit) {
          throw new SeatError(409, `No control seats available (${usage.controlSeatsUsed}/${usage.controlSeatsLimit}). Increase seats in Billing first.`);
        }
        if (seatType === "field" && usage.fieldSeatsUsed >= usage.fieldSeatsLimit) {
          throw new SeatError(409, `No field seats available (${usage.fieldSeatsUsed}/${usage.fieldSeatsLimit}). Increase seats in Billing first.`);
        }

        await tx
          .update(invitationsTable)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(invitationsTable.tenantId, tenantId),
              eq(invitationsTable.email, email),
              isNull(invitationsTable.acceptedAt),
              isNull(invitationsTable.revokedAt),
            ),
          );

        const [row] = await tx
          .insert(invitationsTable)
          .values({
            tenantId,
            email,
            role,
            seatType,
            tokenHash,
            invitedByUserId: req.auth!.user.id,
            expiresAt,
          })
          .returning();
        return row;
      });
    } catch (err) {
      if (err instanceof SeatError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }

    const acceptUrl = `${getAppBaseUrl()}/accept-invite?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendEmail({
        tenantId,
        template: "team.invitation",
        to: [{ email }],
        subject: `You've been invited to ${tenantName} on CtrlTrade®`,
        text: `${req.auth!.user.name} invited you to join ${tenantName} on CtrlTrade®.\n\nAccept your invitation here:\n${acceptUrl}\n\nThis link expires in 7 days.\n`,
      });
    } catch (err) {
      logger.error({ err, tenantId }, "Invitation email failed");
    }

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "team.invited",
      message: `Invited ${email} as ${role}/${seatType}.`,
      metadata: { email, role, seatType, invitationId: inv.id },
    });

    res.status(201).json(
      ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        seatType: inv.seatType,
        invitedByLabel: req.auth!.user.email,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        acceptUrl: process.env.NODE_ENV !== "production" ? acceptUrl : null,
      }),
    );
  },
);

router.post(
  "/v1/team/invitations/:invitationId/resend",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const tenantName = req.auth!.tenant!.name;
    const [existing] = await db
      .select()
      .from(invitationsTable)
      .where(
        and(
          eq(invitationsTable.id, String(req.params.invitationId)),
          eq(invitationsTable.tenantId, tenantId),
        ),
      );
    if (!existing || existing.acceptedAt || existing.revokedAt) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [updated] = await db
      .update(invitationsTable)
      .set({ tokenHash, expiresAt })
      .where(eq(invitationsTable.id, existing.id))
      .returning();
    const acceptUrl = `${getAppBaseUrl()}/accept-invite?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendEmail({
        tenantId,
        template: "team.invitation",
        to: [{ email: existing.email }],
        subject: `Reminder: join ${tenantName} on CtrlTrade®`,
        text: `Reminder — you have a pending invitation to join ${tenantName} on CtrlTrade®.\n\nAccept here:\n${acceptUrl}\n\nThis link expires in 7 days.\n`,
      });
    } catch (err) {
      logger.error({ err }, "Resend invitation email failed");
    }
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "team.invitation_resent",
      message: `Resent invitation to ${existing.email}.`,
      metadata: { invitationId: existing.id },
    });
    res.json(
      ({
        id: updated.id,
        email: updated.email,
        role: updated.role,
        seatType: updated.seatType,
        invitedByLabel: req.auth!.user.email,
        expiresAt: updated.expiresAt.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        acceptUrl: process.env.NODE_ENV !== "production" ? acceptUrl : null,
      }),
    );
  },
);

router.delete(
  "/v1/team/invitations/:invitationId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const [existing] = await db
      .select()
      .from(invitationsTable)
      .where(
        and(
          eq(invitationsTable.id, String(req.params.invitationId)),
          eq(invitationsTable.tenantId, tenantId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    await db
      .update(invitationsTable)
      .set({ revokedAt: new Date() })
      .where(eq(invitationsTable.id, existing.id));
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "team.invitation_revoked",
      message: `Revoked invitation for ${existing.email}.`,
      metadata: { invitationId: existing.id },
    });
    res.status(204).end();
  },
);

router.patch(
  "/v1/team/members/:userId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const userId = String(req.params.userId);
    const [target] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(403).json({ error: "Owner cannot be modified through this endpoint" });
      return;
    }
    const updates: Record<string, unknown> = {};
    const audit: string[] = [];

    if (parsed.data.role && parsed.data.role !== target.role) {
      if (!ROLES.has(parsed.data.role) || parsed.data.role === "owner") {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      updates.role = parsed.data.role;
      audit.push(`role ${target.role}→${parsed.data.role}`);
    }
    if (parsed.data.seatType && parsed.data.seatType !== target.seatType) {
      if (!SEAT_TYPES.has(parsed.data.seatType)) {
        res.status(400).json({ error: "Invalid seat type" });
        return;
      }
      updates.seatType = parsed.data.seatType;
      audit.push(`seat ${target.seatType}→${parsed.data.seatType}`);
    }
    if (parsed.data.status && parsed.data.status !== target.status) {
      if (parsed.data.status !== "active" && parsed.data.status !== "disabled") {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      if (parsed.data.status === "active") updates.disabledAt = null;
      else updates.disabledAt = new Date();
      updates.status = parsed.data.status;
      audit.push(`status ${target.status}→${parsed.data.status}`);
    }

    if (Object.keys(updates).length === 0) {
      // No-op — return current.
    } else {
      try {
        await db.transaction(async (tx) => {
          // Lock subscription row to serialize seat-cap checks against concurrent mutations.
          await tx
            .select({ id: subscriptionsTable.id })
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.tenantId, tenantId))
            .for("update");

          const newSeat = (updates.seatType as string | undefined) ?? target.seatType;
          const newStatus = (updates.status as string | undefined) ?? target.status;
          const willBeActive = newStatus === "active";
          const wasActiveOnSameSeat = target.status === "active" && target.seatType === newSeat;

          if (willBeActive && !wasActiveOnSameSeat) {
            const usage = await computeSeatUsage(tenantId, tx);
            const limit = newSeat === "control" ? usage.controlSeatsLimit : usage.fieldSeatsLimit;
            const used = newSeat === "control" ? usage.controlSeatsUsed : usage.fieldSeatsUsed;
            // If the user is currently active on a different bucket, they release that seat
            // before claiming the new one — so the same usage snapshot already excludes their
            // contribution to `used` for the new bucket.
            if (used + 1 > limit) {
              throw new SeatError(409, `No ${newSeat} seats available; increase seats in Billing first.`);
            }
          }

          await tx
            .update(membershipsTable)
            .set(updates)
            .where(eq(membershipsTable.id, target.id));
        });
      } catch (err) {
        if (err instanceof SeatError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
      await logAudit({
        tenantId,
        actorUserId: req.auth!.user.id,
        actorLabel: req.auth!.user.email,
        kind: parsed.data.status === "disabled" ? "team.disabled" : "team.updated",
        message: `Updated member ${userId}: ${audit.join(", ")}`,
        metadata: { userId, changes: updates },
      });
    }

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const [updated] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
    res.json(
      ({
        userId,
        name: userRow.name,
        email: userRow.email,
        role: updated.role,
        seatType: updated.seatType,
        status: updated.status,
        isYou: req.auth!.user.id === userId,
        invitedAt: updated.invitedAt?.toISOString() ?? null,
        disabledAt: updated.disabledAt?.toISOString() ?? null,
        lastLoginAt: userRow.lastLoginAt?.toISOString() ?? null,
      }),
    );
  },
);

router.delete(
  "/v1/team/members/:userId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const userId = String(req.params.userId);
    const [target] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "owner") {
      res.status(403).json({ error: "Cannot remove the tenant owner" });
      return;
    }
    if (userId === req.auth!.user.id) {
      res.status(400).json({ error: "Use a different account to remove yourself" });
      return;
    }
    await db
      .delete(membershipsTable)
      .where(eq(membershipsTable.id, target.id));
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "team.removed",
      message: `Removed member ${userId} from tenant.`,
      metadata: { userId },
    });
    res.status(204).end();
  },
);

router.post(
  "/v1/team/members/:userId/password-reset",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const userId = String(req.params.userId);
    const [target] = await db
      .select({ user: usersTable, role: membershipsTable.role })
      .from(membershipsTable)
      .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({
      userId: target.user.id,
      tokenHash,
      expiresAt,
    });
    const link = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendEmail({
        tenantId,
        template: "auth.password_reset",
        to: [{ email: target.user.email, name: target.user.name }],
        subject: "Reset your CtrlTrade® password",
        text: `Hi ${target.user.name},\n\nA password reset was requested by ${req.auth!.user.email}.\n\nReset your password:\n${link}\n\nThis link expires in 1 hour.\n`,
      });
    } catch (err) {
      logger.error({ err }, "Password reset email failed");
    }
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "team.password_reset_requested",
      message: `Sent password reset to ${target.user.email}.`,
      metadata: { userId: target.user.id },
    });
    res.json(
      ({
        ok: true,
        devLink: process.env.NODE_ENV !== "production" ? link : null,
      }),
    );
  },
);

export default router;
