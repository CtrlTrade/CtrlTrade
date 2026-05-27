import { Router, type IRouter } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  invitationsTable,
  membershipsTable,
  passwordResetTokensTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import {
  AcceptInvitationBody,
  RequestPasswordResetBody,
  CompletePasswordResetBody,
} from "@workspace/api-zod";
import { hashPassword } from "../lib/auth";
import { serializeTenant, serializeUser } from "../lib/serializers";
import { logAudit } from "../lib/audit";
import { getAppBaseUrl } from "../lib/email";
import { dispatchNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.get("/v1/public/invitations/:token", async (req, res): Promise<void> => {
  const tokenHash = hashToken(req.params.token);
  const [inv] = await db
    .select({ inv: invitationsTable, tenantName: tenantsTable.name })
    .from(invitationsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, invitationsTable.tenantId))
    .where(
      and(
        eq(invitationsTable.tokenHash, tokenHash),
        isNull(invitationsTable.acceptedAt),
        isNull(invitationsTable.revokedAt),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    );
  if (!inv) {
    res.status(404).json({ error: "Invitation not found or expired" });
    return;
  }
  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, inv.inv.email));
  res.json(
    ({
      tenantName: inv.tenantName,
      email: inv.inv.email,
      role: inv.inv.role,
      seatType: inv.inv.seatType,
      expiresAt: inv.inv.expiresAt.toISOString(),
      requiresPassword: !existingUser,
    }),
  );
});

router.post("/v1/public/invitations/:token/accept", async (req, res): Promise<void> => {
  const parsed = AcceptInvitationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenHash = hashToken(req.params.token);

  // Atomic claim of the invitation token.
  const [claimed] = await db
    .update(invitationsTable)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(invitationsTable.tokenHash, tokenHash),
        isNull(invitationsTable.acceptedAt),
        isNull(invitationsTable.revokedAt),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!claimed) {
    res.status(400).json({ error: "Invalid or expired invitation" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claimed.tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  // Find or create the user. If we have to create one, require name+password.
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, claimed.email));

  let user = existingUser ?? null;
  if (!user) {
    if (!parsed.data.password || !parsed.data.name) {
      // Roll back the acceptance so the user can retry with full credentials.
      await db
        .update(invitationsTable)
        .set({ acceptedAt: null })
        .where(eq(invitationsTable.id, claimed.id));
      res.status(400).json({ error: "Name and password (min 8 chars) are required for a new account" });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await db
      .insert(usersTable)
      .values({
        email: claimed.email,
        name: parsed.data.name,
        passwordHash,
        status: "active",
      })
      .returning();
    user = created;
  }

  // Upsert membership for this tenant.
  const [existingMembership] = await db
    .select()
    .from(membershipsTable)
    .where(and(eq(membershipsTable.tenantId, tenant.id), eq(membershipsTable.userId, user.id)));
  let membership;
  if (existingMembership) {
    [membership] = await db
      .update(membershipsTable)
      .set({
        role: claimed.role,
        seatType: claimed.seatType,
        status: "active",
        invitedAt: claimed.createdAt,
        disabledAt: null,
      })
      .where(eq(membershipsTable.id, existingMembership.id))
      .returning();
  } else {
    [membership] = await db
      .insert(membershipsTable)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        role: claimed.role,
        seatType: claimed.seatType,
        status: "active",
        invitedAt: claimed.createdAt,
      })
      .returning();
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "team.accepted",
    message: `${user.email} accepted invitation as ${claimed.role}/${claimed.seatType}.`,
    metadata: { invitationId: claimed.id, userId: user.id },
  });

  // Establish a session for the newly-joined member.
  req.session.userId = user.id;
  req.session.tenantId = tenant.id;
  req.session.impersonatedTenantId = undefined;

  res.json(
    ({
      user: serializeUser(user, membership),
      tenant: await serializeTenant(tenant),
      impersonation: null,
    }),
  );
});

router.post("/v1/public/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  let devLink: string | null = null;
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    const link = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      // tenantId is required by sendEmail; use a synthetic null-safe fallback by picking first membership tenant, else log only.
      const [m] = await db
        .select({ tenantId: membershipsTable.tenantId })
        .from(membershipsTable)
        .where(eq(membershipsTable.userId, user.id));
      if (m) {
        await dispatchNotification({
          tenantId: m.tenantId,
          eventKind: "auth.password_reset",
          vars: { name: user.name, resetUrl: link },
          to: { email: user.email, name: user.name },
        });
      } else {
        logger.info({ email, link }, "Password reset link (no tenant membership)");
      }
    } catch (err) {
      logger.error({ err }, "Password reset email failed");
    }
    if (process.env.NODE_ENV !== "production") devLink = link;
  }
  // Always respond OK to avoid email enumeration.
  res.json(({ ok: true, devLink }));
});

router.post("/v1/public/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = CompletePasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenHash = hashToken(parsed.data.token);
  const [tok] = await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!tok) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .update(usersTable)
    .set({ passwordHash, status: "active", disabledAt: null })
    .where(eq(usersTable.id, tok.userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Audit against any membership tenant for traceability.
  const memberships = await db
    .select({ tenantId: membershipsTable.tenantId })
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, user.id));
  for (const m of memberships) {
    await logAudit({
      tenantId: m.tenantId,
      actorUserId: user.id,
      actorLabel: user.email,
      kind: "team.password_reset_completed",
      message: `Password reset completed for ${user.email}.`,
    });
  }
  res.json(({ ok: true, email: user.email }));
});

export default router;
