import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import { and, desc, eq, gte, ilike, inArray, lt, sql, isNull } from "drizzle-orm";
import * as archiverNS from "archiver";
const archiver: any = (archiverNS as any).default ?? archiverNS;
import {
  db,
  tenantsTable,
  usersTable,
  membershipsTable,
  subscriptionsTable,
  auditLogsTable,
  invitationsTable,
  tenantDeletionRequestsTable,
  featureFlagsTable,
  customersTable,
  quotesTable,
  jobsTable,
  invoicesTable,
  leadsTable,
  branchesTable,
  projectsTable,
} from "@workspace/db";
import {
  GetAdminDashboardResponse,
  GetAdminActivityResponse,
  GetRevenueBreakdownResponse,
  GetUpcomingRenewalsResponse,
  ListAdminTenantsResponse,
  GetAdminTenantResponse,
  AdminUpdateTenantQuantitiesBody,
  AdminUpdateTenantQuantitiesResponse,
  AdminCancelTenantResponse,
  AdminReactivateTenantResponse,
  AdminSyncTenantResponse,
  GetAdminTenantAuditLogResponse,
  AdminIssuePosLicenceBody,
  AdminUpdatePosLicenceBody,
} from "@workspace/api-zod";
import { requireSuperAdmin } from "../middlewares/auth";
import { hashPassword, slugify } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { setObjectAclPolicy } from "../lib/objectAcl";
import {
  generateLicenceKey,
  loadLicenceList,
  serializeLicence,
  LICENCE_STATUSES,
} from "../lib/posLicence";
import { posLicencesTable, platformSettingsTable } from "@workspace/db";
import {
  serializeSubscription,
  serializeTenant,
  getTenantSubscription,
} from "../lib/serializers";
import { computeMonthlyTotal, PRICING } from "../lib/pricing";
import { logAudit } from "../lib/audit";
import { updateQuantitiesForTenant } from "./subscription";
import { isStripeConnected, getUncachableStripeClient } from "../stripeClient";
import { reconcileFromStripeSubscription } from "../lib/stripeReconcile";

const router: IRouter = Router();

// Stop-impersonation must work WHILE impersonating, so it bypasses the
// router-wide guard and validates super admin manually.
router.post("/v1/admin/impersonation/stop", async (req, res): Promise<void> => {
  if (!req.auth?.user?.isSuperAdmin) {
    res.status(403).json({ error: "Super admin only" });
    return;
  }
  const tenantId = req.session?.impersonatedTenantId;
  req.session.impersonatedTenantId = undefined;
  req.session.impersonationStartedAt = undefined;
  if (tenantId) {
    await logAudit({
      tenantId,
      actorUserId: req.auth.user.id,
      actorLabel: `superadmin:${req.auth.user.email}`,
      kind: "admin.impersonation_stopped",
      message: `${req.auth.user.email} stopped impersonating tenant.`,
    });
  }
  res.json({
    user: {
      id: req.auth.user.id,
      email: req.auth.user.email,
      name: req.auth.user.name,
      role: "super_admin",
      isSuperAdmin: true,
      seatType: null,
    },
    tenant: null,
    impersonation: null,
  });
});

router.use("/v1/admin", requireSuperAdmin);

router.get("/v1/admin/dashboard", async (_req, res): Promise<void> => {
  const allSubs = await db.select().from(subscriptionsTable);
  let mrr = 0;
  let activeControl = 0;
  let activeField = 0;
  let activeTills = 0;
  let activeTenants = 0;
  let trials = 0;
  let pastDue = 0;
  for (const s of allSubs) {
    if (s.status === "active" || s.status === "trial") {
      activeTenants++;
      activeControl += s.controlSeats;
      activeField += s.fieldSeats;
      activeTills += s.tills;
      mrr += computeMonthlyTotal(s.controlSeats, s.fieldSeats, s.tills);
    }
    if (s.status === "trial") trials++;
    if (s.status === "past_due") pastDue++;
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const failed = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogsTable)
    .where(
      and(
        eq(auditLogsTable.kind, "invoice.payment_failed"),
        gte(auditLogsTable.createdAt, thirtyDaysAgo),
      ),
    );
  const sevenDays = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const upcoming = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptionsTable)
    .where(
      and(
        lt(subscriptionsTable.currentPeriodEnd, sevenDays),
        gte(subscriptionsTable.currentPeriodEnd, new Date()),
      ),
    );
  const totalTenantsRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantsTable);
  res.json(
    GetAdminDashboardResponse.parse({
      mrr,
      arr: mrr * 12,
      currency: PRICING.currency,
      activeTrials: trials,
      pastDue,
      failedPaymentsLast30d: failed[0]?.count ?? 0,
      upcomingRenewals7d: upcoming[0]?.count ?? 0,
      activeTenants,
      totalTenants: totalTenantsRow[0]?.count ?? 0,
      activeControlSeats: activeControl,
      activeFieldSeats: activeField,
      activeTills,
      revenueByLine: [
        { label: "Control Seats", amount: activeControl * PRICING.controlSeat.amount, units: activeControl },
        { label: "Field Seats", amount: activeField * PRICING.fieldSeat.amount, units: activeField },
        { label: "CtrlTradePos Tills", amount: activeTills * PRICING.till.amount, units: activeTills },
      ],
    }),
  );
});

router.get("/v1/admin/revenue-breakdown", async (_req, res): Promise<void> => {
  const allSubs = await db.select().from(subscriptionsTable);
  let controlAmount = 0;
  let fieldAmount = 0;
  let tillAmount = 0;
  let controlQty = 0;
  let fieldQty = 0;
  let tillQty = 0;
  for (const s of allSubs) {
    if (s.status === "active" || s.status === "trial") {
      controlQty += s.controlSeats;
      fieldQty += s.fieldSeats;
      tillQty += s.tills;
      controlAmount += s.controlSeats * PRICING.controlSeat.amount;
      fieldAmount += s.fieldSeats * PRICING.fieldSeat.amount;
      tillAmount += s.tills * PRICING.till.amount;
    }
  }
  res.json(
    GetRevenueBreakdownResponse.parse({
      currency: PRICING.currency,
      lines: [
        { label: "Control Seats", amount: controlAmount, units: controlQty },
        { label: "Field Seats", amount: fieldAmount, units: fieldQty },
        { label: "CtrlTradePos Tills", amount: tillAmount, units: tillQty },
      ],
    }),
  );
});

router.get("/v1/admin/activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: auditLogsTable.id,
      tenantId: auditLogsTable.tenantId,
      kind: auditLogsTable.kind,
      message: auditLogsTable.message,
      actorLabel: auditLogsTable.actorLabel,
      createdAt: auditLogsTable.createdAt,
      tenantName: tenantsTable.name,
    })
    .from(auditLogsTable)
    .leftJoin(tenantsTable, eq(tenantsTable.id, auditLogsTable.tenantId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50);
  res.json(
    GetAdminActivityResponse.parse(
      rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId ?? null,
        tenantName: r.tenantName ?? null,
        kind: r.kind,
        message: r.message,
        actorLabel: r.actorLabel ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/v1/admin/upcoming-renewals", async (_req, res): Promise<void> => {
  const horizon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      tenantId: subscriptionsTable.tenantId,
      tenantName: tenantsTable.name,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      controlSeats: subscriptionsTable.controlSeats,
      fieldSeats: subscriptionsTable.fieldSeats,
      tills: subscriptionsTable.tills,
      status: subscriptionsTable.status,
    })
    .from(subscriptionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, subscriptionsTable.tenantId))
    .where(
      and(
        lt(subscriptionsTable.currentPeriodEnd, horizon),
        gte(subscriptionsTable.currentPeriodEnd, new Date()),
      ),
    )
    .orderBy(subscriptionsTable.currentPeriodEnd);
  res.json(
    GetUpcomingRenewalsResponse.parse(
      rows.map((r) => ({
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        renewsAt: r.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
        amount: computeMonthlyTotal(r.controlSeats, r.fieldSeats, r.tills),
        currency: PRICING.currency,
        status: r.status,
      })),
    ),
  );
});

router.get("/v1/admin/tenants", async (req, res): Promise<void> => {
  const search = (req.query.search as string | undefined)?.trim();
  const status = req.query.status as string | undefined;
  const filters = [] as any[];
  if (search) filters.push(ilike(tenantsTable.name, `%${search}%`));
  if (status && status !== "all") filters.push(eq(tenantsTable.status, status));
  const whereExpr = filters.length > 0 ? and(...filters) : undefined;
  const tRows = await db
    .select()
    .from(tenantsTable)
    .where(whereExpr as any)
    .orderBy(desc(tenantsTable.createdAt))
    .limit(200);

  const ids = tRows.map((t) => t.id);
  const subs = ids.length > 0
    ? await db.select().from(subscriptionsTable).where(inArray(subscriptionsTable.tenantId, ids))
    : [];
  const owners = ids.length > 0
    ? await db
        .select({
          tenantId: membershipsTable.tenantId,
          email: usersTable.email,
          name: usersTable.name,
        })
        .from(membershipsTable)
        .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
        .where(
          and(inArray(membershipsTable.tenantId, ids), eq(membershipsTable.role, "owner")),
        )
    : [];
  const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
  const ownerByTenant = new Map(owners.map((o) => [o.tenantId, o]));

  res.json(
    ListAdminTenantsResponse.parse(
      tRows.map((t) => {
        const s = subByTenant.get(t.id);
        const o = ownerByTenant.get(t.id);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          ownerEmail: o?.email ?? "",
          monthlyTotal: s ? computeMonthlyTotal(s.controlSeats, s.fieldSeats, s.tills) : 0,
          currency: PRICING.currency,
          controlSeats: s?.controlSeats ?? 0,
          fieldSeats: s?.fieldSeats ?? 0,
          tills: s?.tills ?? 0,
          createdAt: t.createdAt.toISOString(),
          trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
        };
      }),
    ),
  );
});

router.post("/v1/admin/tenants", async (req, res): Promise<void> => {
  const body = z
    .object({
      name: z.string().min(2),
      ownerEmail: z.string().email(),
      ownerName: z.string().min(1),
      ownerPassword: z.string().min(8),
      status: z.enum(["trial", "active", "cancelled", "suspended"]).optional().default("active"),
      controlSeats: z.number().int().min(0).optional().default(1),
      fieldSeats: z.number().int().min(0).optional().default(1),
      tills: z.number().int().min(0).optional().default(1),
      branchName: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { name, ownerEmail, ownerName, ownerPassword, status, controlSeats, fieldSeats, tills, branchName } = body.data;

  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, ownerEmail));
  if (existingUser.length > 0) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  let baseSlug = slugify(name);
  let slug = baseSlug;
  for (let i = 1; i <= 20; i++) {
    const found = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (found.length === 0) break;
    slug = `${baseSlug}-${i}`;
  }

  const passwordHash = await hashPassword(ownerPassword);

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ name, slug, status })
    .returning();

  const [user] = await db
    .insert(usersTable)
    .values({ email: ownerEmail, name: ownerName, passwordHash })
    .returning();

  await db.insert(membershipsTable).values({
    tenantId: tenant.id,
    userId: user.id,
    role: "owner",
    seatType: "control",
  });

  await db.insert(subscriptionsTable).values({
    tenantId: tenant.id,
    stripeSubscriptionId: "manual",
    stripeCustomerId: "manual",
    status: status === "trial" ? "trialing" : "active",
    controlSeats,
    fieldSeats,
    tills,
    currency: "gbp",
    cancelAtPeriodEnd: false,
  });

  await db.insert(branchesTable).values({
    tenantId: tenant.id,
    name: branchName?.trim() || name,
  });

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: `superadmin:${req.auth?.user?.email ?? "system"}`,
    kind: "tenant.created",
    message: `Tenant "${name}" created by super-admin. Owner: ${ownerEmail}.`,
    metadata: { slug, ownerEmail },
  });

  const sub = await getTenantSubscription(tenant.id);
  res.status(201).json({
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    controlSeats: sub?.controlSeats ?? 0,
    fieldSeats: sub?.fieldSeats ?? 0,
    tills: sub?.tills ?? 0,
    monthlyTotal: sub ? computeMonthlyTotal(sub.controlSeats, sub.fieldSeats, sub.tills) : 0,
    currency: sub?.currency ?? "gbp",
    createdAt: tenant.createdAt.toISOString(),
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    ownerEmail,
  });
});

router.patch("/v1/admin/tenants/:tenantId", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const body = z
    .object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).optional(),
      status: z.enum(["trial", "active", "cancelled", "suspended"]).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof tenantsTable.$inferInsert> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.slug !== undefined) {
    const newSlug = slugify(body.data.slug);
    const existing = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.slug, newSlug), sql`id != ${tenantId}`));
    if (existing.length > 0) {
      res.status(409).json({ error: "Slug is already taken" });
      return;
    }
    updates.slug = newSlug;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(tenantsTable)
    .set(updates)
    .where(eq(tenantsTable.id, tenantId))
    .returning();

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "tenant.updated",
    message: `Tenant updated by super-admin: ${JSON.stringify(updates)}.`,
    metadata: updates,
  });

  const sub = await getTenantSubscription(tenantId);
  const [ownerRow] = await db
    .select({ email: usersTable.email })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.role, "owner")));

  res.json({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    controlSeats: sub?.controlSeats ?? 0,
    fieldSeats: sub?.fieldSeats ?? 0,
    tills: sub?.tills ?? 0,
    monthlyTotal: sub ? computeMonthlyTotal(sub.controlSeats, sub.fieldSeats, sub.tills) : 0,
    currency: sub?.currency ?? "gbp",
    createdAt: updated.createdAt.toISOString(),
    trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
    ownerEmail: ownerRow?.email ?? "",
  });
});

router.delete("/v1/admin/tenants/:tenantId", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "tenant.deleted",
    message: `Tenant "${tenant.name}" permanently deleted by super-admin.`,
    metadata: { slug: tenant.slug },
  });

  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));

  res.status(204).end();
});

router.get("/v1/admin/tenants/:tenantId", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const sub = await getTenantSubscription(tenant.id);
  if (!sub) {
    res.status(409).json({ error: "Tenant has no subscription record" });
    return;
  }
  const memberships = await db
    .select({
      role: membershipsTable.role,
      seatType: membershipsTable.seatType,
      userId: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isSuperAdmin: usersTable.isSuperAdmin,
      totpEnabled: usersTable.totpEnabled,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(eq(membershipsTable.tenantId, tenant.id));
  const owner = memberships.find((m) => m.role === "owner");
  if (!owner) {
    res.status(409).json({ error: "Tenant has no owner" });
    return;
  }

  const recentEvents = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenant.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(20);

  const [branchCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(branchesTable)
    .where(eq(branchesTable.tenantId, tenant.id));

  const [projectsAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(eq(projectsTable.tenantId, tenant.id));

  res.json(
    GetAdminTenantResponse.parse({
      tenant: await serializeTenant(tenant),
      owner: {
        id: owner.userId,
        email: owner.email,
        name: owner.name,
        role: owner.role,
        isSuperAdmin: owner.isSuperAdmin ?? false,
        totpEnabled: owner.totpEnabled ?? false,
        seatType: owner.seatType ?? null,
      },
      subscription: serializeSubscription(sub),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        kind: e.kind,
        message: e.message,
        actor: e.actorLabel ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      branchCount: branchCountRow?.count ?? 0,
      projectsCount: projectsAgg?.count ?? 0,
    }),
  );
});

router.patch("/v1/admin/tenants/:tenantId/quantities", async (req, res): Promise<void> => {
  const parsed = AdminUpdateTenantQuantitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.params.tenantId;
  await updateQuantitiesForTenant(tenantId, parsed.data, {
    userId: req.auth!.user.id,
    label: `superadmin:${req.auth!.user.email}`,
  });
  const sub = await getTenantSubscription(tenantId);
  res.json(AdminUpdateTenantQuantitiesResponse.parse(serializeSubscription(sub!)));
});

router.post("/v1/admin/tenants/:tenantId/cancel", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  if ((await isStripeConnected()) && tenant.stripeSubscriptionId) {
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(tenant.stripeSubscriptionId, { cancel_at_period_end: true });
    } catch (err) {
      req.log.warn({ err }, "Stripe cancel failed");
    }
  }
  await db
    .update(tenantsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(tenantsTable.id, tenantId));
  await db
    .update(subscriptionsTable)
    .set({ status: "cancelled", cancelAtPeriodEnd: true })
    .where(eq(subscriptionsTable.tenantId, tenantId));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "tenant.admin_cancelled",
    message: "Tenant cancelled by super admin.",
  });
  const updated = await getTenantSubscription(tenantId);
  res.json(AdminCancelTenantResponse.parse(serializeSubscription(updated!)));
});

router.post("/v1/admin/tenants/:tenantId/reactivate", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const sub = await getTenantSubscription(tenantId);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }
  if (await isStripeConnected()) {
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
      await reconcileFromStripeSubscription(sub.stripeSubscriptionId, "manual.admin_reactivate");
    } catch (err) {
      req.log.warn({ err }, "Stripe reactivate failed");
    }
  } else {
    await db
      .update(tenantsTable)
      .set({ status: "active", cancelledAt: null })
      .where(eq(tenantsTable.id, tenantId));
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "tenant.admin_reactivated",
    message: "Tenant reactivated by super admin.",
  });
  const updated = await getTenantSubscription(tenantId);
  res.json(AdminReactivateTenantResponse.parse(serializeSubscription(updated!)));
});

router.post("/v1/admin/tenants/:tenantId/sync-stripe", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not connected" });
    return;
  }
  if (tenant.stripeSubscriptionId) {
    await reconcileFromStripeSubscription(tenant.stripeSubscriptionId, "manual.admin_sync");
  }
  const sub = await getTenantSubscription(tenantId);
  res.json(AdminSyncTenantResponse.parse(serializeSubscription(sub!)));
});

router.get("/v1/admin/tenants/:tenantId/audit-log", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(200);
  res.json(
    GetAdminTenantAuditLogResponse.parse(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        message: r.message,
        actor: r.actorLabel ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

// ===========================================================================
// Impersonation
// ===========================================================================
router.post("/v1/admin/tenants/:tenantId/impersonate", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  req.session.impersonatedTenantId = tenant.id;
  req.session.impersonationStartedAt = new Date().toISOString();
  await logAudit({
    tenantId: tenant.id,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.impersonation_started",
    message: `${req.auth!.user.email} started impersonating ${tenant.name}.`,
  });
  res.json({
    user: {
      id: req.auth!.user.id,
      email: req.auth!.user.email,
      name: req.auth!.user.name,
      role: "owner",
      isSuperAdmin: true,
      seatType: "control",
    },
    tenant: await serializeTenant(tenant),
    impersonation: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      impersonatorEmail: req.auth!.user.email,
      startedAt: req.session.impersonationStartedAt,
    },
  });
});

// ===========================================================================
// Manual billing override
// ===========================================================================
router.patch("/v1/admin/tenants/:tenantId/billing-override", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const status = String(req.body?.status ?? "");
  const reason = String(req.body?.reason ?? "manual override");
  const allowedStatuses = ["trial", "active", "past_due", "cancelled"];
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of ${allowedStatuses.join("|")}` });
    return;
  }
  const sub = await getTenantSubscription(tenantId);
  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  let trialEndsAt: Date | null | undefined = undefined;
  if ("trialEndsAt" in (req.body ?? {})) {
    trialEndsAt = req.body.trialEndsAt ? new Date(String(req.body.trialEndsAt)) : null;
  }
  const subUpdates: Record<string, unknown> = { status };
  if (trialEndsAt !== undefined) subUpdates.trialEndsAt = trialEndsAt;
  await db
    .update(subscriptionsTable)
    .set(subUpdates)
    .where(eq(subscriptionsTable.tenantId, tenantId));
  const tenantUpdates: Record<string, unknown> = { status: status === "past_due" ? "active" : status };
  if (status === "cancelled") tenantUpdates.cancelledAt = new Date();
  if (trialEndsAt !== undefined) tenantUpdates.trialEndsAt = trialEndsAt;
  await db.update(tenantsTable).set(tenantUpdates).where(eq(tenantsTable.id, tenantId));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.billing_status_override",
    message: `Billing status overridden to ${status}. Reason: ${reason}`,
    metadata: { status, reason, trialEndsAt: trialEndsAt?.toISOString?.() ?? null },
  });
  const updated = await getTenantSubscription(tenantId);
  res.json(serializeSubscription(updated!));
});

// ===========================================================================
// GDPR — data export (zip)
// ===========================================================================
router.get("/v1/admin/tenants/:tenantId/gdpr-export", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ctrltrade-gdpr-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.zip"`,
  );
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err: unknown) => {
    req.log.error({ err }, "GDPR archive error");
    res.end();
  });
  archive.pipe(res);

  async function dumpTable(name: string, rows: unknown[]) {
    archive.append(JSON.stringify(rows, null, 2), { name: `${name}.json` });
  }

  const [members, custs, qts, jbs, invs, lds, audits, subs] = await Promise.all([
    db
      .select({
        userId: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: membershipsTable.role,
        seatType: membershipsTable.seatType,
        status: membershipsTable.status,
        invitedAt: membershipsTable.invitedAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(membershipsTable)
      .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
      .where(eq(membershipsTable.tenantId, tenantId)),
    db.select().from(customersTable).where(eq(customersTable.tenantId, tenantId)),
    db.select().from(quotesTable).where(eq(quotesTable.tenantId, tenantId)),
    db.select().from(jobsTable).where(eq(jobsTable.tenantId, tenantId)),
    db.select().from(invoicesTable).where(eq(invoicesTable.tenantId, tenantId)),
    db.select().from(leadsTable).where(eq(leadsTable.tenantId, tenantId)),
    db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.tenantId, tenantId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(2000),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.tenantId, tenantId)),
  ]);

  await Promise.all([
    dumpTable("tenant", [tenant]),
    dumpTable("members", members),
    dumpTable("customers", custs),
    dumpTable("quotes", qts),
    dumpTable("jobs", jbs),
    dumpTable("invoices", invs),
    dumpTable("leads", lds),
    dumpTable("audit_log", audits),
    dumpTable("subscription", subs),
  ]);
  archive.append(
    `CtrlTrade® GDPR data export for tenant ${tenant.name} (${tenant.slug})\nGenerated ${new Date().toISOString()} by ${req.auth!.user.email}.\n`,
    { name: "README.txt" },
  );

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.gdpr_export",
    message: `Generated GDPR export for tenant ${tenant.name}.`,
  });
  await archive.finalize();
});

// ===========================================================================
// GDPR — deletion state + scheduling + cancel + purge
// ===========================================================================
function serializeDeletion(row: typeof tenantDeletionRequestsTable.$inferSelect | null) {
  if (!row) {
    return { status: "none", requestedAt: null, scheduledPurgeAt: null, cancelledAt: null, purgedAt: null, requestedByLabel: null, reason: null, canPurgeNow: false };
  }
  const canPurgeNow = row.status === "pending" && row.scheduledPurgeAt.getTime() <= Date.now();
  return {
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    scheduledPurgeAt: row.scheduledPurgeAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    purgedAt: row.purgedAt?.toISOString() ?? null,
    requestedByLabel: row.requestedByLabel,
    reason: row.reason,
    canPurgeNow,
  };
}

router.get("/v1/admin/tenants/:tenantId/gdpr-deletion", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [latest] = await db
    .select()
    .from(tenantDeletionRequestsTable)
    .where(eq(tenantDeletionRequestsTable.tenantId, tenantId))
    .orderBy(desc(tenantDeletionRequestsTable.requestedAt))
    .limit(1);
  res.json(serializeDeletion(latest ?? null));
});

router.post("/v1/admin/tenants/:tenantId/gdpr-deletion", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const reason = req.body?.reason ? String(req.body.reason) : null;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  // Reject if there's already a pending request.
  const [existing] = await db
    .select()
    .from(tenantDeletionRequestsTable)
    .where(
      and(
        eq(tenantDeletionRequestsTable.tenantId, tenantId),
        eq(tenantDeletionRequestsTable.status, "pending"),
      ),
    );
  if (existing) {
    res.status(409).json({ error: "A deletion is already scheduled. Cancel it before scheduling another." });
    return;
  }
  const scheduledPurgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(tenantDeletionRequestsTable)
    .values({
      tenantId,
      requestedByUserId: req.auth!.user.id,
      requestedByLabel: `superadmin:${req.auth!.user.email}`,
      reason,
      scheduledPurgeAt,
      status: "pending",
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.gdpr_deletion_scheduled",
    message: `Scheduled tenant deletion in 30 days (purge ${scheduledPurgeAt.toISOString()}). Reason: ${reason ?? "n/a"}`,
    metadata: { scheduledPurgeAt: scheduledPurgeAt.toISOString(), reason },
  });
  res.json(serializeDeletion(row));
});

router.delete("/v1/admin/tenants/:tenantId/gdpr-deletion", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [updated] = await db
    .update(tenantDeletionRequestsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(tenantDeletionRequestsTable.tenantId, tenantId),
        eq(tenantDeletionRequestsTable.status, "pending"),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "No pending deletion to cancel" });
    return;
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.gdpr_deletion_cancelled",
    message: "Scheduled tenant deletion cancelled.",
  });
  res.json(serializeDeletion(updated));
});

router.post("/v1/admin/tenants/:tenantId/gdpr-deletion/purge", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId;
  const [pending] = await db
    .select()
    .from(tenantDeletionRequestsTable)
    .where(
      and(
        eq(tenantDeletionRequestsTable.tenantId, tenantId),
        eq(tenantDeletionRequestsTable.status, "pending"),
      ),
    );
  if (!pending) {
    res.status(404).json({ error: "No pending deletion to purge" });
    return;
  }
  if (pending.scheduledPurgeAt.getTime() > Date.now()) {
    res.status(409).json({
      error: `Cooldown active until ${pending.scheduledPurgeAt.toISOString()}. Wait or cancel and reschedule.`,
    });
    return;
  }
  // Atomically delete the tenant and mark the request purged. ON DELETE CASCADE handles the rest.
  // If tenant deletion fails, the status update is rolled back so the request stays "pending".
  const updated = await db.transaction(async (tx) => {
    await tx.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    const [row] = await tx
      .update(tenantDeletionRequestsTable)
      .set({ status: "purged", purgedAt: new Date() })
      .where(eq(tenantDeletionRequestsTable.id, pending.id))
      .returning();
    return row;
  });
  await logAudit({
    tenantId: null,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.gdpr_deletion_purged",
    message: `Purged tenant ${tenantId}.`,
    metadata: { tenantId },
  });
  res.json(serializeDeletion(updated));
});

// ===========================================================================
// Feature flags (global + per-tenant)
// ===========================================================================
async function serializeFlag(row: typeof featureFlagsTable.$inferSelect) {
  let tenantName: string | null = null;
  if (row.tenantId) {
    const [t] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, row.tenantId));
    tenantName = t?.name ?? null;
  }
  let updatedByLabel: string | null = null;
  if (row.updatedByUserId) {
    const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, row.updatedByUserId));
    updatedByLabel = u?.email ?? null;
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName,
    scope: row.tenantId ? "tenant" : "global",
    key: row.key,
    enabled: row.enabled,
    rolloutPct: row.rolloutPct,
    description: row.description,
    updatedByLabel,
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/v1/admin/feature-flags", async (req, res): Promise<void> => {
  const tenantId = (req.query.tenantId as string | undefined) ?? undefined;
  let rows;
  if (tenantId) {
    rows = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.tenantId, tenantId))
      .orderBy(featureFlagsTable.key);
  } else {
    rows = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.tenantId, featureFlagsTable.key);
  }
  const out = await Promise.all(rows.map(serializeFlag));
  res.json(out);
});

router.post("/v1/admin/feature-flags", async (req, res): Promise<void> => {
  const key = String(req.body?.key ?? "").trim();
  if (!key) {
    res.status(400).json({ error: "key is required" });
    return;
  }
  const enabled = Boolean(req.body?.enabled);
  let rolloutPct = Number(req.body?.rolloutPct ?? 100);
  if (!Number.isFinite(rolloutPct) || rolloutPct < 0 || rolloutPct > 100) rolloutPct = 100;
  const description = req.body?.description ? String(req.body.description) : null;
  const tenantId = req.body?.tenantId ? String(req.body.tenantId) : null;

  const existingFilter = tenantId
    ? and(eq(featureFlagsTable.key, key), eq(featureFlagsTable.tenantId, tenantId))
    : and(eq(featureFlagsTable.key, key), isNull(featureFlagsTable.tenantId));
  const [existing] = await db.select().from(featureFlagsTable).where(existingFilter);

  let row;
  if (existing) {
    [row] = await db
      .update(featureFlagsTable)
      .set({
        enabled,
        rolloutPct,
        description,
        updatedByUserId: req.auth!.user.id,
      })
      .where(eq(featureFlagsTable.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(featureFlagsTable)
      .values({
        tenantId,
        key,
        enabled,
        rolloutPct,
        description,
        updatedByUserId: req.auth!.user.id,
      })
      .returning();
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.feature_flag_changed",
    message: `Feature flag "${key}" set to enabled=${enabled} rollout=${rolloutPct}% (${tenantId ? "tenant" : "global"}).`,
    metadata: { key, tenantId, enabled, rolloutPct },
  });
  res.json(await serializeFlag(row));
});

router.delete("/v1/admin/feature-flags/:flagId", async (req, res): Promise<void> => {
  const [existing] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.id, req.params.flagId));
  if (!existing) {
    res.status(404).json({ error: "Feature flag not found" });
    return;
  }
  await db.delete(featureFlagsTable).where(eq(featureFlagsTable.id, existing.id));
  await logAudit({
    tenantId: existing.tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.feature_flag_changed",
    message: `Feature flag "${existing.key}" removed.`,
    metadata: { key: existing.key, tenantId: existing.tenantId, deleted: true },
  });
  res.status(204).end();
});

// ---- CtrlTradePos® licensing (super admin) -------------------------------

router.get("/v1/admin/tenants/:tenantId/pos-licences", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId as string;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(await loadLicenceList(tenantId));
});

router.post("/v1/admin/tenants/:tenantId/pos-licences", async (req, res): Promise<void> => {
  const tenantId = req.params.tenantId as string;
  const parsed = AdminIssuePosLicenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  if (parsed.data.branchId) {
    const [branch] = await db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.id, parsed.data.branchId), eq(branchesTable.tenantId, tenantId)));
    if (!branch) {
      res.status(400).json({ error: "Branch does not belong to this business." });
      return;
    }
  }
  const status = parsed.data.status ?? "active";
  const trialEndsAt =
    status === "trial"
      ? new Date(Date.now() + (parsed.data.trialDays ?? 14) * 24 * 60 * 60 * 1000)
      : null;
  const [row] = await db
    .insert(posLicencesTable)
    .values({
      tenantId,
      branchId: parsed.data.branchId ?? null,
      licenceKey: generateLicenceKey(),
      type: parsed.data.type,
      status,
      trialEndsAt,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "pos.licence.issued",
    message: `Super admin issued ${parsed.data.type} till licence (${status})`,
    metadata: { licenceId: row.id, licenceKey: row.licenceKey },
  });
  res.status(201).json(serializeLicence(row, null, []));
});

router.patch("/v1/admin/pos-licences/:licenceId", async (req, res): Promise<void> => {
  const licenceId = req.params.licenceId as string;
  const parsed = AdminUpdatePosLicenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(posLicencesTable)
    .where(eq(posLicencesTable.id, licenceId));
  if (!existing) {
    res.status(404).json({ error: "Licence not found" });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    if (!LICENCE_STATUSES.includes(parsed.data.status as (typeof LICENCE_STATUSES)[number])) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    patch.status = parsed.data.status;
    // Ensure a trial always has an end date; default to 14 days when none is set yet.
    if (parsed.data.status === "trial" && !existing.trialEndsAt) {
      patch.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    }
  }
  if (parsed.data.branchId !== undefined) {
    if (parsed.data.branchId) {
      const [branch] = await db
        .select()
        .from(branchesTable)
        .where(and(eq(branchesTable.id, parsed.data.branchId), eq(branchesTable.tenantId, existing.tenantId)));
      if (!branch) {
        res.status(400).json({ error: "Branch does not belong to this business." });
        return;
      }
    }
    patch.branchId = parsed.data.branchId;
  }
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  const [updated] = await db
    .update(posLicencesTable)
    .set(patch)
    .where(eq(posLicencesTable.id, licenceId))
    .returning();
  await logAudit({
    tenantId: updated.tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "pos.licence.updated",
    message: `Super admin updated till licence ${updated.licenceKey}${parsed.data.status ? ` → ${parsed.data.status}` : ""}`,
    metadata: { licenceId: updated.id },
  });
  res.json(serializeLicence(updated, null, []));
});

// ---- POS Download URLs (super admin) ---------------------------------------
const httpsUrlOrNull = z.union([
  z.string().url().startsWith("https://"),
  z.literal(""),
  z.null(),
]);
const UpdatePosDownloadsBody = z.object({
  windowsUrl: httpsUrlOrNull.optional(),
  macosUrl: httpsUrlOrNull.optional(),
});

async function readPosDownloadUrls() {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(
      sql`key IN ('windows_url', 'macos_url')`,
    );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    windowsUrl: (map["windows_url"] as string | null | undefined) ?? null,
    macosUrl: (map["macos_url"] as string | null | undefined) ?? null,
  };
}

router.get("/v1/admin/pos-downloads", async (_req, res): Promise<void> => {
  res.json(await readPosDownloadUrls());
});

router.put("/v1/admin/pos-downloads", async (req, res): Promise<void> => {
  const parsed = UpdatePosDownloadsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid URL — must be https:// or null" });
    return;
  }
  const { windowsUrl, macosUrl } = parsed.data;
  if (windowsUrl !== undefined) {
    await db
      .insert(platformSettingsTable)
      .values({ key: "windows_url", value: windowsUrl || null })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: windowsUrl || null } });
  }
  if (macosUrl !== undefined) {
    await db
      .insert(platformSettingsTable)
      .values({ key: "macos_url", value: macosUrl || null })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: macosUrl || null } });
  }
  res.json(await readPosDownloadUrls());
});

const installerObjectStorage = new ObjectStorageService();

const RequestInstallerUploadUrlBody = z.object({
  platform: z.enum(["windows", "macos"]),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  contentType: z.string().min(1),
});

router.post("/v1/admin/pos-downloads/request-installer-upload-url", async (req, res): Promise<void> => {
  const parsed = RequestInstallerUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }
  try {
    const uploadUrl = await installerObjectStorage.getObjectEntityUploadURL();
    const objectPath = installerObjectStorage.normalizeObjectEntityPath(uploadUrl);
    res.json({ uploadUrl, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to generate installer upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

const ConfirmInstallerUploadBody = z.object({
  platform: z.enum(["windows", "macos"]),
  objectPath: z.string().min(1),
});

router.post("/v1/admin/pos-downloads/confirm-installer-upload", async (req, res): Promise<void> => {
  const parsed = ConfirmInstallerUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }
  const { platform, objectPath } = parsed.data;
  try {
    const objectFile = await installerObjectStorage.getObjectEntityFile(objectPath);
    await setObjectAclPolicy(objectFile, {
      owner: "admin",
      visibility: "public",
    });
    const servingUrl = `/api/storage${objectPath}`;
    const dbKey = platform === "windows" ? "windows_url" : "macos_url";
    await db
      .insert(platformSettingsTable)
      .values({ key: dbKey, value: servingUrl })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: servingUrl } });
    await logAudit({
      tenantId: null,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "admin.pos_installer_uploaded",
      message: `Uploaded new ${platform} POS installer: ${objectPath}`,
      metadata: { platform, objectPath, servingUrl },
    });
    res.json(await readPosDownloadUrls());
  } catch (err) {
    req.log.error({ err }, "Failed to confirm installer upload");
    res.status(500).json({ error: "Failed to confirm upload" });
  }
});

export default router;
