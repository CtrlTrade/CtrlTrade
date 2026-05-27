import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, customDomainsTable, tenantsTable, type Tenant, type CustomDomain } from "@workspace/db";

declare module "express-serve-static-core" {
  interface Request {
    customDomain?: {
      domain: CustomDomain;
      tenant: Tenant;
    };
  }
}

function extractHost(req: Request): string | null {
  const fwd = req.headers["x-forwarded-host"];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.headers["host"];
  if (!raw) return null;
  return String(raw).split(",")[0].trim().split(":")[0].toLowerCase();
}

/**
 * If the request's Host header maps to a verified custom domain, attach the
 * resolved tenant + domain to the request for downstream routes (portal,
 * branding, etc.). Unverified or unknown hosts pass through with no effect.
 */
export async function resolveCustomDomain(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const host = extractHost(req);
    if (!host) return next();
    const [domain] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.hostname, host), eq(customDomainsTable.status, "verified")));
    if (!domain) return next();
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, domain.tenantId));
    if (tenant) req.customDomain = { domain, tenant };
  } catch (err) {
    req.log?.warn({ err }, "custom domain resolution failed");
  }
  next();
}
