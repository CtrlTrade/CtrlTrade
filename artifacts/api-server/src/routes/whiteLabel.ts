import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  tenantsTable,
  customDomainsTable,
  resellerProfilesTable,
  subscriptionsTable,
  membershipsTable,
  jobsTable,
  leadsTable,
  invoicesTable,
  type CustomDomain,
  type ResellerProfile,
  type Tenant,
} from "@workspace/db";
import { requireSuperAdmin, requireAuth, requireTenant, requireRole } from "../middlewares/auth";
import { serializeTenant } from "../lib/serializers";
import { computeMonthlyTotal, PRICING } from "../lib/pricing";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function serializeDomain(d: CustomDomain) {
  return {
    id: d.id,
    tenantId: d.tenantId,
    hostname: d.hostname,
    kind: d.kind,
    status: d.status,
    verificationToken: d.verificationToken,
    verificationRecord: `ctrltrade-verify=${d.verificationToken}`,
    verifiedAt: d.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
    lastError: d.lastError ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

function serializeReseller(r: ResellerProfile | null) {
  if (!r) return null;
  return {
    id: r.id,
    tenantId: r.tenantId,
    displayName: r.displayName,
    contactEmail: r.contactEmail,
    revenueSharePct: r.revenueSharePct,
    notes: r.notes,
    active: r.active,
  };
}

async function childSummariesFor(parentTenantId: string) {
  const children = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.parentTenantId, parentTenantId))
    .orderBy(desc(tenantsTable.createdAt));
  if (children.length === 0) {
    return {
      children: [] as Array<any>,
      totalMrr: 0,
      currency: PRICING.currency,
      totalJobsCount: 0,
      totalLeadsCount: 0,
      totalPaidRevenuePence: 0,
    };
  }
  const childIds = children.map((c) => c.id);
  const [subs, jobsAgg, leadsAgg, revenueAgg] = await Promise.all([
    db.select().from(subscriptionsTable).where(inArray(subscriptionsTable.tenantId, childIds)),
    db
      .select({ tenantId: jobsTable.tenantId, count: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(inArray(jobsTable.tenantId, childIds))
      .groupBy(jobsTable.tenantId),
    db
      .select({ tenantId: leadsTable.tenantId, count: sql<number>`count(*)::int` })
      .from(leadsTable)
      .where(inArray(leadsTable.tenantId, childIds))
      .groupBy(leadsTable.tenantId),
    db
      .select({ tenantId: invoicesTable.tenantId, total: sql<number>`coalesce(sum(total_pence),0)::bigint` })
      .from(invoicesTable)
      .where(and(inArray(invoicesTable.tenantId, childIds), eq(invoicesTable.status, "paid")))
      .groupBy(invoicesTable.tenantId),
  ]);
  const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
  const jobsByTenant = new Map(jobsAgg.map((r) => [r.tenantId, Number(r.count)]));
  const leadsByTenant = new Map(leadsAgg.map((r) => [r.tenantId, Number(r.count)]));
  const revByTenant = new Map(revenueAgg.map((r) => [r.tenantId, Number(r.total)]));
  let totalMrr = 0;
  let totalJobsCount = 0;
  let totalLeadsCount = 0;
  let totalPaidRevenuePence = 0;
  const summaries = children.map((t) => {
    const s = subByTenant.get(t.id);
    const mrr = s && (s.status === "active" || s.status === "trial")
      ? computeMonthlyTotal(s.controlSeats, s.fieldSeats, s.tills)
      : 0;
    const jobsCount = jobsByTenant.get(t.id) ?? 0;
    const leadsCount = leadsByTenant.get(t.id) ?? 0;
    const paidRevenuePence = revByTenant.get(t.id) ?? 0;
    totalMrr += mrr;
    totalJobsCount += jobsCount;
    totalLeadsCount += leadsCount;
    totalPaidRevenuePence += paidRevenuePence;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      mrr,
      currency: s?.currency ?? PRICING.currency,
      controlSeats: s?.controlSeats ?? 0,
      fieldSeats: s?.fieldSeats ?? 0,
      tills: s?.tills ?? 0,
      jobsCount,
      leadsCount,
      paidRevenuePence,
      createdAt: t.createdAt.toISOString(),
    };
  });
  return {
    children: summaries,
    totalMrr,
    currency: PRICING.currency,
    totalJobsCount,
    totalLeadsCount,
    totalPaidRevenuePence,
  };
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tenant";
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 50; i++) {
    const [existing] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, candidate));
    if (!existing) return candidate;
    candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
  }
  throw new Error("Could not generate unique slug");
}

async function findActiveResellerProfileForUser(userId: string): Promise<ResellerProfile | null> {
  const memberships = await db
    .select({ tenantId: membershipsTable.tenantId })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.status, "active")));
  if (memberships.length === 0) return null;
  const profiles = await db
    .select()
    .from(resellerProfilesTable)
    .where(inArray(resellerProfilesTable.tenantId, memberships.map((m) => m.tenantId)));
  return profiles.find((p) => p.active) ?? null;
}

// ===========================================================================
// Admin: white-label config + reseller profile
// ===========================================================================
router.get(
  "/v1/admin/tenants/:tenantId/white-label",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(req.params.tenantId);
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    let parent: Tenant | null = null;
    if (tenant.parentTenantId) {
      const [p] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.parentTenantId));
      parent = p ?? null;
    }
    const [reseller] = await db
      .select()
      .from(resellerProfilesTable)
      .where(eq(resellerProfilesTable.tenantId, tenantId));
    res.json({
      tenant: await serializeTenant(tenant),
      parent: parent ? await serializeTenant(parent) : null,
      reseller: serializeReseller(reseller ?? null),
    });
  },
);

router.patch(
  "/v1/admin/tenants/:tenantId/white-label",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(req.params.tenantId);
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const body = (req.body ?? {}) as {
      parentTenantId?: string | null;
      whiteLabelConfig?: Record<string, unknown> | null;
      reseller?: {
        displayName?: string;
        contactEmail?: string;
        revenueSharePct?: number;
        notes?: string;
        active?: boolean;
      } | null;
    };

    const updates: Partial<typeof tenantsTable.$inferInsert> = {};
    if ("parentTenantId" in body) {
      if (body.parentTenantId && body.parentTenantId !== tenantId) {
        const [p] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, body.parentTenantId));
        if (!p) {
          res.status(400).json({ error: "parent tenant not found" });
          return;
        }
        updates.parentTenantId = body.parentTenantId;
      } else {
        updates.parentTenantId = null;
      }
    }
    if ("whiteLabelConfig" in body) {
      updates.whiteLabelConfig = body.whiteLabelConfig as any;
    }
    if (Object.keys(updates).length) {
      await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, tenantId));
    }

    if ("reseller" in body) {
      const r = body.reseller;
      const [existing] = await db
        .select()
        .from(resellerProfilesTable)
        .where(eq(resellerProfilesTable.tenantId, tenantId));
      if (r === null) {
        if (existing) {
          await db.delete(resellerProfilesTable).where(eq(resellerProfilesTable.id, existing.id));
        }
      } else if (r) {
        const sharePct = Math.max(0, Math.min(100, Math.round(r.revenueSharePct ?? existing?.revenueSharePct ?? 0)));
        if (existing) {
          await db
            .update(resellerProfilesTable)
            .set({
              displayName: r.displayName ?? existing.displayName,
              contactEmail: r.contactEmail ?? existing.contactEmail,
              revenueSharePct: sharePct,
              notes: r.notes ?? existing.notes,
              active: r.active ?? existing.active,
            })
            .where(eq(resellerProfilesTable.id, existing.id));
        } else {
          await db.insert(resellerProfilesTable).values({
            tenantId,
            displayName: r.displayName ?? null,
            contactEmail: r.contactEmail ?? null,
            revenueSharePct: sharePct,
            notes: r.notes ?? null,
            active: r.active ?? true,
          });
        }
      }
    }

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "admin.white_label_updated",
      message: "White-label / franchise configuration updated.",
      metadata: { parentTenantId: updates.parentTenantId, hasResellerChange: "reseller" in body },
    });

    const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    res.json(await serializeTenant(fresh));
  },
);

// ===========================================================================
// Admin: child tenants list
// ===========================================================================
router.get(
  "/v1/admin/tenants/:tenantId/children",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { children } = await childSummariesFor(String(req.params.tenantId));
    res.json(children);
  },
);

// ===========================================================================
// Admin: custom domains
// ===========================================================================
router.get(
  "/v1/admin/tenants/:tenantId/custom-domains",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select()
      .from(customDomainsTable)
      .where(eq(customDomainsTable.tenantId, String(req.params.tenantId)))
      .orderBy(desc(customDomainsTable.createdAt));
    res.json(rows.map(serializeDomain));
  },
);

router.post(
  "/v1/admin/tenants/:tenantId/custom-domains",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(req.params.tenantId);
    const hostname = String(req.body?.hostname ?? "").trim().toLowerCase();
    const kind = req.body?.kind === "app" ? "app" : "portal";
    if (!/^[a-z0-9.-]{3,253}$/.test(hostname) || !hostname.includes(".")) {
      res.status(400).json({ error: "Invalid hostname" });
      return;
    }
    const [exists] = await db.select().from(customDomainsTable).where(eq(customDomainsTable.hostname, hostname));
    if (exists) {
      res.status(409).json({ error: "Hostname is already registered" });
      return;
    }
    const verificationToken = crypto.randomBytes(16).toString("hex");
    const [row] = await db
      .insert(customDomainsTable)
      .values({ tenantId, hostname, kind, verificationToken, status: "pending" })
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "admin.custom_domain_added",
      message: `Custom domain ${hostname} added (${kind}).`,
      metadata: { hostname, kind },
    });
    res.status(201).json(serializeDomain(row));
  },
);

router.delete(
  "/v1/admin/tenants/:tenantId/custom-domains/:domainId",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(req.params.tenantId);
    const domainId = String(req.params.domainId);
    const [existing] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.id, domainId), eq(customDomainsTable.tenantId, tenantId)));
    if (!existing) {
      res.status(404).json({ error: "Custom domain not found" });
      return;
    }
    await db.delete(customDomainsTable).where(eq(customDomainsTable.id, domainId));
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "admin.custom_domain_removed",
      message: `Custom domain ${existing.hostname} removed.`,
      metadata: { hostname: existing.hostname },
    });
    res.status(204).end();
  },
);

router.post(
  "/v1/admin/tenants/:tenantId/custom-domains/:domainId/verify",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(req.params.tenantId);
    const domainId = String(req.params.domainId);
    const [existing] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.id, domainId), eq(customDomainsTable.tenantId, tenantId)));
    if (!existing) {
      res.status(404).json({ error: "Custom domain not found" });
      return;
    }
    const expected = `ctrltrade-verify=${existing.verificationToken}`;
    let verified = false;
    let lastError: string | null = null;
    try {
      const dns = await import("node:dns/promises");
      const records = await dns.resolveTxt(existing.hostname);
      verified = records.some((chunks) => chunks.join("").trim() === expected);
      if (!verified) lastError = `Expected TXT "${expected}" not found at ${existing.hostname}`;
    } catch (err: any) {
      lastError = err?.message ? `DNS lookup failed: ${err.message}` : "DNS lookup failed";
    }
    const [updated] = await db
      .update(customDomainsTable)
      .set({
        status: verified ? "verified" : "failed",
        verifiedAt: verified ? new Date() : existing.verifiedAt,
        lastCheckedAt: new Date(),
        lastError: verified ? null : lastError,
      })
      .where(eq(customDomainsTable.id, domainId))
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: verified ? "admin.custom_domain_verified" : "admin.custom_domain_verify_failed",
      message: verified
        ? `Custom domain ${existing.hostname} verified.`
        : `Custom domain ${existing.hostname} verification failed: ${lastError}`,
      metadata: { hostname: existing.hostname, verified },
    });
    res.json(serializeDomain(updated));
  },
);

// ===========================================================================
// Tenant self-service custom domains (owner/admin only).
// Tenants register their own domains; super-admin retains verification authority.
// ===========================================================================
router.get(
  "/v1/app/custom-domains",
  requireTenant,
  requireRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const rows = await db
      .select()
      .from(customDomainsTable)
      .where(eq(customDomainsTable.tenantId, tenantId))
      .orderBy(desc(customDomainsTable.createdAt));
    res.json(rows.map(serializeDomain));
  },
);

router.post(
  "/v1/app/custom-domains",
  requireTenant,
  requireRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const hostname = String(req.body?.hostname ?? "").trim().toLowerCase();
    const kind = req.body?.kind === "app" ? "app" : "portal";
    if (!/^[a-z0-9.-]{3,253}$/.test(hostname) || !hostname.includes(".")) {
      res.status(400).json({ error: "Invalid hostname" });
      return;
    }
    const [exists] = await db.select().from(customDomainsTable).where(eq(customDomainsTable.hostname, hostname));
    if (exists) {
      res.status(409).json({ error: "Hostname is already registered" });
      return;
    }
    const verificationToken = crypto.randomBytes(16).toString("hex");
    const [row] = await db
      .insert(customDomainsTable)
      .values({ tenantId, hostname, kind, verificationToken, status: "pending" })
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "tenant.custom_domain_added",
      message: `Custom domain ${hostname} registered (${kind}). Awaiting super-admin verification.`,
      metadata: { hostname, kind },
    });
    res.status(201).json(serializeDomain(row));
  },
);

router.delete(
  "/v1/app/custom-domains/:domainId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const domainId = String(req.params.domainId);
    const [existing] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.id, domainId), eq(customDomainsTable.tenantId, tenantId)));
    if (!existing) {
      res.status(404).json({ error: "Custom domain not found" });
      return;
    }
    await db.delete(customDomainsTable).where(eq(customDomainsTable.id, domainId));
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "tenant.custom_domain_removed",
      message: `Custom domain ${existing.hostname} removed by tenant.`,
      metadata: { hostname: existing.hostname },
    });
    res.status(204).end();
  },
);

// ===========================================================================
// Reseller dashboard (any tenant member of a tenant that has a reseller profile)
// ===========================================================================
router.get(
  "/v1/reseller/dashboard",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await findActiveResellerProfileForUser(req.auth!.user.id);
    if (!profile) {
      res.status(403).json({ error: "No reseller profile assigned to your tenant" });
      return;
    }
    const { children, totalMrr, currency } = await childSummariesFor(profile.tenantId);
    res.json({
      tenantId: profile.tenantId,
      displayName: profile.displayName,
      totalMrr,
      revenueSharePct: profile.revenueSharePct,
      expectedPayoutMrr: Math.round(((totalMrr * profile.revenueSharePct) / 100) * 100) / 100,
      currency,
      children,
    });
  },
);

// ===========================================================================
// Reseller self-service: provision a new child tenant under the reseller
// ===========================================================================
router.post(
  "/v1/reseller/children",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profile = await findActiveResellerProfileForUser(req.auth!.user.id);
    if (!profile) {
      res.status(403).json({ error: "No reseller profile assigned to your tenant" });
      return;
    }
    const name = String(req.body?.name ?? "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "name is required (min 2 chars)" });
      return;
    }
    const slugBase = req.body?.slug ? slugify(String(req.body.slug)) : slugify(name);
    const slug = await uniqueSlug(slugBase);
    const inherit = req.body?.inheritWhiteLabel === true;
    const [parent] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, profile.tenantId));
    const country = req.body?.country ? String(req.body.country) : parent?.country ?? null;
    const insertValues: typeof tenantsTable.$inferInsert = {
      name,
      slug,
      status: "trial",
      country,
      parentTenantId: profile.tenantId,
    };
    if (inherit && parent) {
      insertValues.brandColor = parent.brandColor;
      insertValues.primaryColor = parent.primaryColor;
      insertValues.accentColor = parent.accentColor;
      insertValues.surfaceColor = parent.surfaceColor;
      insertValues.fontFamily = parent.fontFamily;
      insertValues.logoUrl = parent.logoUrl;
      insertValues.logoPortalUrl = parent.logoPortalUrl;
      insertValues.faviconUrl = parent.faviconUrl;
      insertValues.whiteLabelConfig = parent.whiteLabelConfig ?? null;
    }
    const [child] = await db.insert(tenantsTable).values(insertValues).returning();
    await logAudit({
      tenantId: profile.tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `reseller:${req.auth!.user.email}`,
      kind: "reseller.child_created",
      message: `Reseller provisioned new child tenant "${name}" (${slug}).`,
      metadata: { childTenantId: child.id, slug, inheritWhiteLabel: inherit },
    });
    await logAudit({
      tenantId: child.id,
      actorUserId: req.auth!.user.id,
      actorLabel: `reseller:${req.auth!.user.email}`,
      kind: "tenant.provisioned",
      message: `Tenant provisioned by reseller ${profile.displayName ?? profile.tenantId}.`,
      metadata: { parentTenantId: profile.tenantId },
    });
    res.status(201).json(await serializeTenant(child));
  },
);

// ===========================================================================
// Franchise rollup (any tenant owner sees aggregate of child tenants)
// ===========================================================================
router.get(
  "/v1/franchise/rollup",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tenant = req.auth?.tenant;
    if (!tenant) {
      res.status(403).json({ error: "No tenant context" });
      return;
    }
    const summary = await childSummariesFor(tenant.id);
    res.json({
      parentTenantId: tenant.id,
      totalMrr: summary.totalMrr,
      currency: summary.currency,
      totalJobsCount: summary.totalJobsCount,
      totalLeadsCount: summary.totalLeadsCount,
      totalPaidRevenuePence: summary.totalPaidRevenuePence,
      children: summary.children,
    });
  },
);

// ===========================================================================
// Public host info — used by white-labelled frontends to discover their tenant
// ===========================================================================
router.get(
  "/v1/public/host-info",
  async (req: Request, res: Response): Promise<void> => {
    const queryHost = req.query.host ? String(req.query.host).toLowerCase() : null;
    const headerHost = req.customDomain?.domain.hostname ?? null;
    const host = queryHost ?? headerHost;
    if (!host) {
      res.json({ hostname: "", matched: false, tenantId: null, tenantSlug: null, tenantName: null, kind: null, whiteLabelConfig: null });
      return;
    }
    const [domain] = await db
      .select()
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.hostname, host), eq(customDomainsTable.status, "verified")));
    if (!domain) {
      res.json({ hostname: host, matched: false, tenantId: null, tenantSlug: null, tenantName: null, kind: null, whiteLabelConfig: null });
      return;
    }
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, domain.tenantId));
    if (!tenant) {
      res.json({ hostname: host, matched: false, tenantId: null, tenantSlug: null, tenantName: null, kind: null, whiteLabelConfig: null });
      return;
    }
    res.json({
      hostname: host,
      matched: true,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      kind: domain.kind,
      whiteLabelConfig: tenant.whiteLabelConfig ?? null,
    });
  },
);

export default router;
