import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  platformReferralPartnersTable,
  platformReferralClicksTable,
  platformReferralConversionsTable,
  platformReferralCommissionsTable,
  platformReferralPayoutsTable,
} from "@workspace/db";
import {
  AdminUpdatePartnerBody,
  AdminDecidePayoutBody,
} from "@workspace/api-zod";
import { requireSuperAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/admin/referrals/partners", requireSuperAdmin, async (_req, res): Promise<void> => {
  const partners = await db.select().from(platformReferralPartnersTable).orderBy(desc(platformReferralPartnersTable.createdAt));
  const out = [];
  for (const p of partners) {
    const [{ clicks }] = await db.select({ clicks: sql<number>`count(*)::int` }).from(platformReferralClicksTable).where(eq(platformReferralClicksTable.partnerId, p.id));
    const [{ signups, paying }] = await db.select({
      signups: sql<number>`count(*)::int`,
      paying: sql<number>`count(*) filter (where status = 'paying')::int`,
    }).from(platformReferralConversionsTable).where(eq(platformReferralConversionsTable.partnerId, p.id));
    const [{ accruedPence }] = await db.select({
      accruedPence: sql<number>`coalesce(sum(commission_pence) filter (where status in ('accrued','approved')),0)::int`,
    }).from(platformReferralCommissionsTable).where(eq(platformReferralCommissionsTable.partnerId, p.id));
    out.push(({
      id: p.id,
      email: p.email,
      name: p.name,
      company: p.company,
      status: p.status,
      commissionType: p.commissionType,
      commissionPct: p.commissionPct,
      commissionFixedPence: p.commissionFixedPence,
      payoutMethod: p.payoutMethod,
      createdAt: p.createdAt.toISOString(),
      totals: { clicks, signups, paying, accruedPence, currency: "gbp" },
    }));
  }
  res.json(out);
});

router.patch("/v1/admin/referrals/partners/:partnerId", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = AdminUpdatePartnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.auth!.user.id;
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "approved") {
    updates.approvedAt = new Date();
    updates.approvedByUserId = userId;
  }
  const [p] = await db.update(platformReferralPartnersTable).set(updates).where(eq(platformReferralPartnersTable.id, req.params.partnerId as string)).returning();
  if (!p) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  await logAudit({
    actorUserId: userId,
    kind: "partner.updated",
    message: `Admin updated partner ${p.email}: ${JSON.stringify(parsed.data)}`,
  });
  const [{ clicks }] = await db.select({ clicks: sql<number>`count(*)::int` }).from(platformReferralClicksTable).where(eq(platformReferralClicksTable.partnerId, p.id));
  const [{ signups, paying }] = await db.select({
    signups: sql<number>`count(*)::int`,
    paying: sql<number>`count(*) filter (where status = 'paying')::int`,
  }).from(platformReferralConversionsTable).where(eq(platformReferralConversionsTable.partnerId, p.id));
  const [{ accruedPence }] = await db.select({
    accruedPence: sql<number>`coalesce(sum(commission_pence) filter (where status in ('accrued','approved')),0)::int`,
  }).from(platformReferralCommissionsTable).where(eq(platformReferralCommissionsTable.partnerId, p.id));
  res.json(({
    id: p.id,
    email: p.email,
    name: p.name,
    company: p.company,
    status: p.status,
    commissionType: p.commissionType,
    commissionPct: p.commissionPct,
    commissionFixedPence: p.commissionFixedPence,
    payoutMethod: p.payoutMethod,
    createdAt: p.createdAt.toISOString(),
    totals: { clicks, signups, paying, accruedPence, currency: "gbp" },
  }));
});

router.get("/v1/admin/referrals/payouts", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: platformReferralPayoutsTable.id,
    partnerId: platformReferralPayoutsTable.partnerId,
    partnerName: platformReferralPartnersTable.name,
    partnerEmail: platformReferralPartnersTable.email,
    amountPence: platformReferralPayoutsTable.amountPence,
    currency: platformReferralPayoutsTable.currency,
    status: platformReferralPayoutsTable.status,
    method: platformReferralPayoutsTable.method,
    reference: platformReferralPayoutsTable.reference,
    notes: platformReferralPayoutsTable.notes,
    requestedAt: platformReferralPayoutsTable.requestedAt,
    decidedAt: platformReferralPayoutsTable.decidedAt,
  })
  .from(platformReferralPayoutsTable)
  .innerJoin(platformReferralPartnersTable, eq(platformReferralPartnersTable.id, platformReferralPayoutsTable.partnerId))
  .orderBy(desc(platformReferralPayoutsTable.requestedAt));
  res.json(rows.map(r => ({
    id: r.id,
    partnerId: r.partnerId,
    partnerName: r.partnerName,
    partnerEmail: r.partnerEmail,
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

router.post("/v1/admin/referrals/payouts/:payoutId/decide", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = AdminDecidePayoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.auth!.user.id;
  const [payout] = await db.update(platformReferralPayoutsTable).set({
    status: parsed.data.status,
    reference: parsed.data.reference ?? null,
    notes: parsed.data.notes ?? null,
    decidedAt: new Date(),
    decidedByUserId: userId,
  }).where(eq(platformReferralPayoutsTable.id, req.params.payoutId as string)).returning();
  if (!payout) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }
  // Update related commissions
  if (parsed.data.status === "paid") {
    await db.update(platformReferralCommissionsTable).set({ status: "paid" }).where(eq(platformReferralCommissionsTable.payoutId, payout.id));
  } else if (parsed.data.status === "rejected") {
    await db.update(platformReferralCommissionsTable).set({ payoutId: null }).where(eq(platformReferralCommissionsTable.payoutId, payout.id));
  } else if (parsed.data.status === "approved") {
    await db.update(platformReferralCommissionsTable).set({ status: "approved" }).where(and(eq(platformReferralCommissionsTable.payoutId, payout.id), eq(platformReferralCommissionsTable.status, "accrued")));
  }
  await logAudit({ actorUserId: userId, kind: "partner.payout_decided", message: `Payout ${payout.id} → ${parsed.data.status}` });
  const [partner] = await db.select().from(platformReferralPartnersTable).where(eq(platformReferralPartnersTable.id, payout.partnerId));
  res.json(({
    id: payout.id,
    partnerId: payout.partnerId,
    partnerName: partner?.name ?? "",
    partnerEmail: partner?.email ?? "",
    amountPence: payout.amountPence,
    currency: payout.currency,
    status: payout.status,
    method: payout.method,
    reference: payout.reference,
    notes: payout.notes,
    requestedAt: payout.requestedAt.toISOString(),
    decidedAt: payout.decidedAt ? payout.decidedAt.toISOString() : null,
  }));
});

export default router;
