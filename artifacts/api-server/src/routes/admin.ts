import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  usersTable,
  membershipsTable,
  subscriptionsTable,
  auditLogsTable,
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
} from "@workspace/api-zod";
import { requireSuperAdmin } from "../middlewares/auth";
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

router.use(requireSuperAdmin);

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

  res.json(
    GetAdminTenantResponse.parse({
      tenant: await serializeTenant(tenant),
      owner: {
        id: owner.userId,
        email: owner.email,
        name: owner.name,
        role: owner.role,
        isSuperAdmin: owner.isSuperAdmin ?? false,
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

export default router;
