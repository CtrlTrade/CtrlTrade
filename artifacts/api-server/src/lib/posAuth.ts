import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  membershipsTable,
  tenantsTable,
  type User,
  type Tenant,
  type Membership,
} from "@workspace/db";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required for POS token signing");
  return s;
}

function b64url(input: Buffer): string {
  return input.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface TokenPayload {
  u: string;
  t: string;
  e: number;
  /** Licence binding captured at till open, re-validated on each mutating request. */
  lk?: string;
  tc?: string;
  sf?: "web" | "desktop";
}

export interface PosLicenceBinding {
  licenceKey?: string | null;
  terminalCode?: string | null;
  surface?: "web" | "desktop";
}

export function signPosToken(
  userId: string,
  tenantId: string,
  licence?: PosLicenceBinding,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const payload: TokenPayload = { u: userId, t: tenantId, e: expiresAt.getTime() };
  if (licence?.licenceKey) payload.lk = licence.licenceKey;
  if (licence?.terminalCode) payload.tc = licence.terminalCode;
  if (licence?.surface) payload.sf = licence.surface;
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return { token: `${body}.${sig}`, expiresAt };
}

function verifyPosToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  try {
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  } catch {
    return null;
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.u !== "string" || typeof payload.t !== "string") return null;
  if (typeof payload.e !== "number" || payload.e < Date.now()) return null;
  return payload;
}

export interface PosAuthContext {
  user: User;
  tenant: Tenant;
  membership: Membership;
  licenceKey?: string;
  terminalCode?: string;
  surface?: "web" | "desktop";
}

declare module "express-serve-static-core" {
  interface Request {
    posAuth?: PosAuthContext;
  }
}

/**
 * Validate a raw POS bearer token and resolve its full auth context (user +
 * tenant + membership + licence binding), or return `null` when the token is
 * invalid/expired or its user/tenant/membership no longer exists.
 *
 * Shared by `requirePosAuth` (header-based) and the SSE live channel route
 * (which receives the token via query param because EventSource cannot send
 * Authorization headers). Reusing this keeps a single POS auth path.
 */
export async function authenticatePosToken(token: string): Promise<PosAuthContext | null> {
  const payload = verifyPosToken(token);
  if (!payload) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.u));
  if (!user) return null;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, payload.t));
  if (!tenant) return null;
  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(and(eq(membershipsTable.tenantId, tenant.id), eq(membershipsTable.userId, user.id)));
  if (!membership) return null;
  return {
    user,
    tenant,
    membership,
    licenceKey: payload.lk,
    terminalCode: payload.tc,
    surface: payload.sf,
  };
}

export async function requirePosAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyPosToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.u));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, payload.t));
  if (!tenant) {
    res.status(401).json({ error: "Tenant not found" });
    return;
  }
  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(and(eq(membershipsTable.tenantId, tenant.id), eq(membershipsTable.userId, user.id)));
  if (!membership) {
    res.status(403).json({ error: "No membership for tenant" });
    return;
  }
  req.posAuth = {
    user,
    tenant,
    membership,
    licenceKey: payload.lk,
    terminalCode: payload.tc,
    surface: payload.sf,
  };
  next();
}
