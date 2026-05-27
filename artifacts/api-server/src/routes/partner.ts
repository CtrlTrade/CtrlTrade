import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, sql, sum } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  platformReferralPartnersTable,
  platformReferralLinksTable,
  platformReferralClicksTable,
  platformReferralLeadsTable,
  platformReferralConversionsTable,
  platformReferralCommissionsTable,
  platformReferralPayoutsTable,
  tenantsTable,
  type PlatformReferralPartner,
} from "@workspace/db";
import {
  PartnerSignupBody,
  PartnerLoginBody,
  CreatePartnerLinkBody,
  RequestPartnerPayoutBody,
  TrackReferralClickBody,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";

declare module "express-session" {
  interface SessionData {
    partnerId?: string;
  }
}

const router: IRouter = Router();

function serializePartner(p: PlatformReferralPartner) {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    company: p.company,
    status: p.status,
    commissionType: p.commissionType,
    commissionPct: p.commissionPct,
    commissionFixedPence: p.commissionFixedPence,
    payoutMethod: p.payoutMethod,
  };
}

function genCode(len = 8): string {
  return crypto.randomBytes(len).toString("base64url").slice(0, len).toUpperCase();
}

function shareUrlFor(code: string, landingPath: string): string {
  const base = process.env.PUBLIC_BASE_URL ?? "";
  const path = landingPath.startsWith("/") ? landingPath : "/" + landingPath;
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${path}${sep}ref=${code}`;
}

async function requirePartner(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.partnerId) {
    res.status(401).json({ error: "Partner not authenticated" });
    return;
  }
  const [p] = await db.select().from(platformReferralPartnersTable).where(eq(platformReferralPartnersTable.id, req.session.partnerId));
  if (!p) {
    res.status(401).json({ error: "Partner not found" });
    return;
  }
  (req as Request & { partner?: PlatformReferralPartner }).partner = p;
  next();
}

// ---- Public auth ----------------------------------------------------------

router.post("/v1/public/partner/signup", async (req, res): Promise<void> => {
  const parsed = PartnerSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(platformReferralPartnersTable).where(eq(platformReferralPartnersTable.email, parsed.data.email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const [p] = await db.insert(platformReferralPartnersTable).values({
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    company: parsed.data.company ?? null,
    passwordHash,
    status: "pending",
  }).returning();
  // auto-create default link
  await db.insert(platformReferralLinksTable).values({
    partnerId: p.id,
    code: genCode(),
    label: "Default",
    landingPath: "/",
  });
  req.session.partnerId = p.id;
  await logAudit({ kind: "partner.signed_up", message: `Partner signed up: ${p.email}` });
  res.json(({ partner: serializePartner(p) }));
});

router.post("/v1/public/partner/login", async (req, res): Promise<void> => {
  const parsed = PartnerLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [p] = await db.select().from(platformReferralPartnersTable).where(eq(platformReferralPartnersTable.email, parsed.data.email.toLowerCase()));
  if (!p || !(await verifyPassword(parsed.data.password, p.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (p.status === "disabled") {
    res.status(403).json({ error: "Account disabled" });
    return;
  }
  req.session.partnerId = p.id;
  res.json(({ partner: serializePartner(p) }));
});

// ---- Referral click tracking (public) --------------------------------------

router.post("/v1/public/referral/track", async (req, res): Promise<void> => {
  const parsed = TrackReferralClickBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [link] = await db.select().from(platformReferralLinksTable).where(eq(platformReferralLinksTable.code, parsed.data.code.toUpperCase()));
  if (link) {
    await db.insert(platformReferralClicksTable).values({
      linkId: link.id,
      partnerId: link.partnerId,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      landingPath: parsed.data.landingPath ?? null,
    });
    res.cookie("ctrltrade_ref", parsed.data.code.toUpperCase(), {
      httpOnly: false,
      sameSite: "lax",
      secure: req.secure,
      maxAge: 1000 * 60 * 60 * 24 * 60, // 60 days
    });
  }
  res.json(({ ok: true }));
});

// ---- Partner session ------------------------------------------------------

router.get("/v1/partner/me", requirePartner, async (req, res): Promise<void> => {
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  res.json(({ partner: serializePartner(p) }));
});

router.post("/v1/partner/logout", async (req, res): Promise<void> => {
  delete req.session.partnerId;
  res.json(({ ok: true }));
});

// ---- Dashboard -----------------------------------------------------------

router.get("/v1/partner/dashboard", requirePartner, async (req, res): Promise<void> => {
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  const [{ clicks }] = await db.select({ clicks: sql<number>`count(*)::int` }).from(platformReferralClicksTable).where(eq(platformReferralClicksTable.partnerId, p.id));
  const [{ leads }] = await db.select({ leads: sql<number>`count(*)::int` }).from(platformReferralLeadsTable).where(eq(platformReferralLeadsTable.partnerId, p.id));
  const [{ signups, paying }] = await db
    .select({
      signups: sql<number>`count(*)::int`,
      paying: sql<number>`count(*) filter (where status = 'paying')::int`,
    })
    .from(platformReferralConversionsTable)
    .where(eq(platformReferralConversionsTable.partnerId, p.id));
  const [{ accruedPence, paidPence }] = await db
    .select({
      accruedPence: sql<number>`coalesce(sum(commission_pence) filter (where status in ('accrued','approved')),0)::int`,
      paidPence: sql<number>`coalesce(sum(commission_pence) filter (where status = 'paid'),0)::int`,
    })
    .from(platformReferralCommissionsTable)
    .where(eq(platformReferralCommissionsTable.partnerId, p.id));

  const convs = await db
    .select({
      id: platformReferralConversionsTable.id,
      tenantName: tenantsTable.name,
      status: platformReferralConversionsTable.status,
      firstPaidAt: platformReferralConversionsTable.firstPaidAt,
      createdAt: platformReferralConversionsTable.createdAt,
    })
    .from(platformReferralConversionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, platformReferralConversionsTable.tenantId))
    .where(eq(platformReferralConversionsTable.partnerId, p.id))
    .orderBy(desc(platformReferralConversionsTable.createdAt))
    .limit(25);

  res.json(({
    totals: {
      clicks,
      leads,
      signups,
      paying,
      accruedPence,
      paidPence,
      currency: "gbp",
    },
    recentClicks: clicks,
    recentLeads: leads,
    conversions: convs.map(c => ({
      id: c.id,
      tenantName: c.tenantName,
      status: c.status,
      firstPaidAt: c.firstPaidAt ? c.firstPaidAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    })),
  }));
});

// ---- Links ---------------------------------------------------------------

router.get("/v1/partner/links", requirePartner, async (req, res): Promise<void> => {
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  const rows = await db
    .select({
      id: platformReferralLinksTable.id,
      code: platformReferralLinksTable.code,
      label: platformReferralLinksTable.label,
      landingPath: platformReferralLinksTable.landingPath,
      createdAt: platformReferralLinksTable.createdAt,
      clicks: sql<number>`(select count(*) from platform_referral_clicks c where c.link_id = ${platformReferralLinksTable.id})::int`,
    })
    .from(platformReferralLinksTable)
    .where(eq(platformReferralLinksTable.partnerId, p.id))
    .orderBy(desc(platformReferralLinksTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id,
    code: r.code,
    label: r.label,
    landingPath: r.landingPath,
    shareUrl: shareUrlFor(r.code, r.landingPath),
    clicks: r.clicks,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/v1/partner/links", requirePartner, async (req, res): Promise<void> => {
  const parsed = CreatePartnerLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  const [row] = await db.insert(platformReferralLinksTable).values({
    partnerId: p.id,
    code: genCode(),
    label: parsed.data.label ?? null,
    landingPath: parsed.data.landingPath ?? "/",
  }).returning();
  res.status(201).json(({
    id: row.id,
    code: row.code,
    label: row.label,
    landingPath: row.landingPath,
    shareUrl: shareUrlFor(row.code, row.landingPath),
    clicks: 0,
    createdAt: row.createdAt.toISOString(),
  }));
});

// ---- Commissions ---------------------------------------------------------

router.get("/v1/partner/commissions", requirePartner, async (req, res): Promise<void> => {
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  const rows = await db
    .select({
      id: platformReferralCommissionsTable.id,
      tenantName: tenantsTable.name,
      periodStart: platformReferralCommissionsTable.periodStart,
      periodEnd: platformReferralCommissionsTable.periodEnd,
      invoiceTotalPence: platformReferralCommissionsTable.invoiceTotalPence,
      commissionPence: platformReferralCommissionsTable.commissionPence,
      currency: platformReferralCommissionsTable.currency,
      status: platformReferralCommissionsTable.status,
      createdAt: platformReferralCommissionsTable.createdAt,
    })
    .from(platformReferralCommissionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, platformReferralCommissionsTable.tenantId))
    .where(eq(platformReferralCommissionsTable.partnerId, p.id))
    .orderBy(desc(platformReferralCommissionsTable.createdAt))
    .limit(200);
  res.json(rows.map(r => ({
    id: r.id,
    tenantName: r.tenantName,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    invoiceTotalPence: r.invoiceTotalPence,
    commissionPence: r.commissionPence,
    currency: r.currency,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

// ---- Payouts -------------------------------------------------------------

router.get("/v1/partner/payouts", requirePartner, async (req, res): Promise<void> => {
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  const rows = await db
    .select()
    .from(platformReferralPayoutsTable)
    .where(eq(platformReferralPayoutsTable.partnerId, p.id))
    .orderBy(desc(platformReferralPayoutsTable.requestedAt));
  res.json(rows.map(r => ({
    id: r.id,
    amountPence: r.amountPence,
    currency: r.currency,
    status: r.status,
    method: r.method,
    reference: r.reference,
    notes: r.notes,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  })));
});

router.post("/v1/partner/payouts", requirePartner, async (req, res): Promise<void> => {
  const parsed = RequestPartnerPayoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const p = (req as Request & { partner: PlatformReferralPartner }).partner;
  // Available = sum of approved + accrued commissions not yet attached to a payout
  const [{ available }] = await db
    .select({ available: sql<number>`coalesce(sum(commission_pence),0)::int` })
    .from(platformReferralCommissionsTable)
    .where(and(
      eq(platformReferralCommissionsTable.partnerId, p.id),
      sql`status in ('accrued','approved') and payout_id is null`,
    ));
  if (available <= 0) {
    res.status(400).json({ error: "No commissions available for payout" });
    return;
  }
  const [payout] = await db.insert(platformReferralPayoutsTable).values({
    partnerId: p.id,
    amountPence: available,
    currency: "gbp",
    status: "requested",
    method: p.payoutMethod ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  await db.update(platformReferralCommissionsTable)
    .set({ payoutId: payout.id })
    .where(and(
      eq(platformReferralCommissionsTable.partnerId, p.id),
      sql`status in ('accrued','approved') and payout_id is null`,
    ));
  await logAudit({ kind: "partner.payout_requested", message: `Partner ${p.email} requested payout £${(available/100).toFixed(2)}` });
  res.status(201).json(({
    id: payout.id,
    amountPence: payout.amountPence,
    currency: payout.currency,
    status: payout.status,
    method: payout.method,
    reference: payout.reference,
    notes: payout.notes,
    requestedAt: payout.requestedAt.toISOString(),
    decidedAt: null,
  }));
});

export default router;
