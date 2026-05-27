import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, usersTable, tenantsTable, membershipsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { encryptToken, decryptToken } from "../lib/tokenCrypt";
import { serializeUser, serializeTenant } from "../lib/serializers";
import { logAudit } from "../lib/audit";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateOtpAuthUri,
} from "../lib/totp";

const router: IRouter = Router();

function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(5).toString("hex").toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

router.get("/v1/auth/2fa/setup", requireAuth, async (req, res): Promise<void> => {
  const user = req.auth!.user;
  if (user.totpEnabled) {
    res.status(409).json({ error: "2FA is already enabled" });
    return;
  }
  const secret = generateTotpSecret();
  const otpAuthUri = generateOtpAuthUri(user.email, "CtrlTrade", secret);

  await db.update(usersTable)
    .set({ totpSecretEnc: encryptToken(secret) })
    .where(eq(usersTable.id, user.id));

  res.json({ otpAuthUri, secret });
});

router.post("/v1/auth/2fa/verify-enrol", requireAuth, async (req, res): Promise<void> => {
  const user = req.auth!.user;
  if (user.totpEnabled) {
    res.status(409).json({ error: "2FA is already enabled" });
    return;
  }
  const code: string | undefined = req.body?.code;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const secret = decryptToken(fresh?.totpSecretEnc);
  if (!secret) {
    res.status(400).json({ error: "No pending 2FA setup. Call GET /v1/auth/2fa/setup first." });
    return;
  }

  const isValid = verifyTotpCode(code, secret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid code. Try again." });
    return;
  }

  const recoveryCodes = generateRecoveryCodes();
  await db.update(usersTable).set({
    totpEnabled: true,
    totpEnrolledAt: new Date(),
    totpRecoveryCodesEnc: encryptToken(JSON.stringify(recoveryCodes)),
  }).where(eq(usersTable.id, user.id));

  await logAudit({
    tenantId: req.auth!.tenant?.id ?? null,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "auth.2fa_enrolled",
    message: `User ${user.email} enrolled 2FA`,
  });

  res.json({ recoveryCodes });
});

router.delete("/v1/auth/2fa", requireAuth, async (req, res): Promise<void> => {
  const user = req.auth!.user;
  if (!user.totpEnabled) {
    res.status(409).json({ error: "2FA is not enabled" });
    return;
  }
  const code: string | undefined = req.body?.code;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const secret = decryptToken(fresh?.totpSecretEnc);
  if (!secret) {
    res.status(400).json({ error: "2FA secret not found" });
    return;
  }
  const isValid = verifyTotpCode(code, secret);
  if (!isValid) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  await db.update(usersTable).set({
    totpEnabled: false,
    totpSecretEnc: null,
    totpRecoveryCodesEnc: null,
    totpEnrolledAt: null,
  }).where(eq(usersTable.id, user.id));

  await logAudit({
    tenantId: req.auth!.tenant?.id ?? null,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "auth.2fa_disabled",
    message: `User ${user.email} disabled 2FA`,
  });

  res.status(204).end();
});

router.get("/v1/auth/2fa/recovery-codes", requireAuth, async (req, res): Promise<void> => {
  const user = req.auth!.user;
  if (!user.totpEnabled) {
    res.status(409).json({ error: "2FA is not enabled" });
    return;
  }
  const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const raw = decryptToken(fresh?.totpRecoveryCodesEnc);
  const recoveryCodes: string[] = raw ? JSON.parse(raw) : [];
  res.json({ recoveryCodes });
});

router.post("/v1/auth/2fa/challenge", async (req, res): Promise<void> => {
  const pendingUserId = req.session?.twoFactorPendingUserId;
  if (!pendingUserId) {
    res.status(401).json({ error: "No pending 2FA session" });
    return;
  }

  const code: string | undefined = req.body?.code;
  const recoveryCode: string | undefined = req.body?.recoveryCode;
  if (!code && !recoveryCode) {
    res.status(400).json({ error: "code or recoveryCode is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pendingUserId));
  if (!user || !user.totpEnabled) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  let verified = false;

  if (code) {
    const secret = decryptToken(user.totpSecretEnc);
    if (!secret) {
      res.status(500).json({ error: "2FA configuration error" });
      return;
    }
    verified = verifyTotpCode(code, secret);
  } else if (recoveryCode) {
    const raw = decryptToken(user.totpRecoveryCodesEnc);
    if (!raw) {
      res.status(400).json({ error: "No recovery codes available" });
      return;
    }
    const codes: string[] = JSON.parse(raw);
    const normalised = recoveryCode.toUpperCase().replace(/[\s-]/g, "");
    const idx = codes.findIndex((c) => c.replace(/-/g, "") === normalised);
    if (idx === -1) {
      res.status(400).json({ error: "Invalid recovery code" });
      return;
    }
    codes.splice(idx, 1);
    await db.update(usersTable)
      .set({ totpRecoveryCodesEnc: encryptToken(JSON.stringify(codes)) })
      .where(eq(usersTable.id, user.id));
    verified = true;
  }

  if (!verified) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  const memberships = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, user.id));
  const firstMembership = memberships.find((m) => m.status === "active") ?? null;

  let tenantPayload = null;
  if (firstMembership) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, firstMembership.tenantId));
    if (tenant) {
      tenantPayload = await serializeTenant(tenant);
      req.session.tenantId = tenant.id;
    }
  }

  delete req.session.twoFactorPendingUserId;
  req.session.userId = user.id;

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  res.json({
    user: serializeUser(user, firstMembership),
    tenant: tenantPayload,
    impersonation: null,
  });
});

export default router;
