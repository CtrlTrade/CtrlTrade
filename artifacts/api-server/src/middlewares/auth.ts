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
    impersonatedTenantId?: string;
    impersonationStartedAt?: string;
  }
}

export interface AuthContext {
  user: User;
  tenant: Tenant | null;
  membership: Membership | null;
  impersonation: {
    tenantId: string;
    tenantName: string;
    impersonatorEmail: string;
    startedAt: string;
  } | null;
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
  if (user.status === "disabled") return null;

  // Resolve effective tenant. If super admin is impersonating, swap tenant.
  let effectiveTenantId = req.session?.tenantId ?? null;
  let impersonation: AuthContext["impersonation"] = null;
  if (user.isSuperAdmin && req.session?.impersonatedTenantId) {
    effectiveTenantId = req.session.impersonatedTenantId;
  }

  let tenant: Tenant | null = null;
  let membership: Membership | null = null;
  if (effectiveTenantId) {
    const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, effectiveTenantId));
    tenant = t ?? null;
    if (tenant) {
      if (user.isSuperAdmin && req.session?.impersonatedTenantId === tenant.id) {
        impersonation = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          impersonatorEmail: user.email,
          startedAt: req.session.impersonationStartedAt ?? new Date().toISOString(),
        };
        // Synthesize a virtual owner membership so super admin can use tenant routes.
        membership = {
          id: "impersonation",
          tenantId: tenant.id,
          userId: user.id,
          role: "owner",
          seatType: "control",
          status: "active",
          invitedAt: null,
          disabledAt: null,
          createdAt: new Date(),
        } as Membership;
      } else {
        const [m] = await db
          .select()
          .from(membershipsTable)
          .where(and(eq(membershipsTable.tenantId, tenant.id), eq(membershipsTable.userId, user.id)));
        membership = m && m.status === "active" ? m : null;
        if (!membership) tenant = null;
      }
    }
  }
  return { user, tenant, membership, impersonation };
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
  // Block super-admin only routes while impersonating to avoid accidents.
  if (req.auth.impersonation) {
    res.status(403).json({ error: "Stop impersonation before using admin tools" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth?.membership) {
      res.status(403).json({ error: "No tenant context" });
      return;
    }
    if (!roles.includes(req.auth.membership.role)) {
      res.status(403).json({ error: "Insufficient role" });
      return;
    }
    next();
  };
}
