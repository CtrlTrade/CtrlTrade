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

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: string;
  }
}

export interface AuthContext {
  user: User;
  tenant: Tenant | null;
  membership: Membership | null;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

async function resolveAuth(req: Request): Promise<AuthContext | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const tenantId = req.session?.tenantId;
  let tenant: Tenant | null = null;
  let membership: Membership | null = null;
  if (tenantId) {
    const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    tenant = t ?? null;
    if (tenant) {
      const [m] = await db
        .select()
        .from(membershipsTable)
        .where(and(eq(membershipsTable.tenantId, tenant.id), eq(membershipsTable.userId, user.id)));
      membership = m ?? null;
    }
  }
  return { user, tenant, membership };
}

export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.auth = (await resolveAuth(req)) ?? undefined;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.auth.tenant || !req.auth.membership) {
    res.status(403).json({ error: "No tenant context" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.auth.user.isSuperAdmin) {
    res.status(403).json({ error: "Super admin only" });
    return;
  }
  next();
}
