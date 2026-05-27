import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  tenantReferralCampaignsTable,
  tenantReferralCodesTable,
  tenantReferralConversionsTable,
  tenantReferralRewardsTable,
  customersTable,
  tenantsTable,
} from "@workspace/db";
import {
  CreateReferralCampaignBody,
  SubmitPortalReferralBody,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function genCode(len = 8) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len).toUpperCase();
}

function rewardSummary(c: { rewardType: string; rewardValuePence: number; rewardForReferrer: boolean; rewardForReferee: boolean }) {
  const amount = c.rewardType === "percent"
    ? `${c.rewardValuePence}%`
    : `£${(c.rewardValuePence / 100).toFixed(2)}`;
  const parts = [];
  if (c.rewardForReferrer) parts.push(`you get ${amount}`);
  if (c.rewardForReferee) parts.push(`your friend gets ${amount}`);
  return parts.join(", ");
}

// ---- Tenant Campaigns ----------------------------------------------------

router.get("/v1/referral-campaigns", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db.select().from(tenantReferralCampaignsTable).where(eq(tenantReferralCampaignsTable.tenantId, tenantId)).orderBy(desc(tenantReferralCampaignsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    rewardType: r.rewardType,
    rewardValuePence: r.rewardValuePence,
    rewardForReferrer: r.rewardForReferrer,
    rewardForReferee: r.rewardForReferee,
    description: r.description,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/v1/referral-campaigns", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateReferralCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [r] = await db.insert(tenantReferralCampaignsTable).values({
    tenantId,
    name: parsed.data.name,
    rewardType: parsed.data.rewardType,
    rewardValuePence: parsed.data.rewardValuePence,
    rewardForReferrer: parsed.data.rewardForReferrer ?? true,
    rewardForReferee: parsed.data.rewardForReferee ?? false,
    description: parsed.data.description ?? null,
    active: parsed.data.active ?? true,
  }).returning();
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "referral_campaign.created", message: `Created campaign: ${r.name}` });
  res.status(201).json(({
    id: r.id, name: r.name, rewardType: r.rewardType, rewardValuePence: r.rewardValuePence,
    rewardForReferrer: r.rewardForReferrer, rewardForReferee: r.rewardForReferee,
    description: r.description, active: r.active, createdAt: r.createdAt.toISOString(),
  }));
});

router.patch("/v1/referral-campaigns/:campaignId", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateReferralCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [r] = await db.update(tenantReferralCampaignsTable).set({
    name: parsed.data.name,
    rewardType: parsed.data.rewardType,
    rewardValuePence: parsed.data.rewardValuePence,
    rewardForReferrer: parsed.data.rewardForReferrer ?? true,
    rewardForReferee: parsed.data.rewardForReferee ?? false,
    description: parsed.data.description ?? null,
    active: parsed.data.active ?? true,
  }).where(and(eq(tenantReferralCampaignsTable.tenantId, tenantId), eq(tenantReferralCampaignsTable.id, req.params.campaignId as string))).returning();
  if (!r) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(({
    id: r.id, name: r.name, rewardType: r.rewardType, rewardValuePence: r.rewardValuePence,
    rewardForReferrer: r.rewardForReferrer, rewardForReferee: r.rewardForReferee,
    description: r.description, active: r.active, createdAt: r.createdAt.toISOString(),
  }));
});

router.delete("/v1/referral-campaigns/:campaignId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const result = await db.delete(tenantReferralCampaignsTable).where(and(eq(tenantReferralCampaignsTable.tenantId, tenantId), eq(tenantReferralCampaignsTable.id, req.params.campaignId as string))).returning({ id: tenantReferralCampaignsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.status(204).send();
});

// ---- Tenant Conversions --------------------------------------------------

router.get("/v1/referral-conversions", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      id: tenantReferralConversionsTable.id,
      campaignName: tenantReferralCampaignsTable.name,
      referrerName: customersTable.name,
      refereeName: tenantReferralConversionsTable.refereeName,
      refereeEmail: tenantReferralConversionsTable.refereeEmail,
      status: tenantReferralConversionsTable.status,
      rewardPence: tenantReferralConversionsTable.rewardPence,
      createdAt: tenantReferralConversionsTable.createdAt,
      rewardedAt: tenantReferralConversionsTable.rewardedAt,
    })
    .from(tenantReferralConversionsTable)
    .innerJoin(tenantReferralCampaignsTable, eq(tenantReferralCampaignsTable.id, tenantReferralConversionsTable.campaignId))
    .leftJoin(customersTable, eq(customersTable.id, tenantReferralConversionsTable.referrerCustomerId))
    .where(eq(tenantReferralConversionsTable.tenantId, tenantId))
    .orderBy(desc(tenantReferralConversionsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id,
    campaignName: r.campaignName,
    referrerName: r.referrerName,
    refereeName: r.refereeName,
    refereeEmail: r.refereeEmail,
    status: r.status,
    rewardPence: r.rewardPence,
    createdAt: r.createdAt.toISOString(),
    rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
  })));
});

router.post("/v1/referral-conversions/:conversionId/reward", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [conv] = await db.select().from(tenantReferralConversionsTable)
    .where(and(eq(tenantReferralConversionsTable.tenantId, tenantId), eq(tenantReferralConversionsTable.id, req.params.conversionId as string)));
  if (!conv) { res.status(404).json({ error: "Conversion not found" }); return; }
  if (conv.status === "rewarded") {
    res.status(400).json({ error: "Already rewarded" });
    return;
  }
  const [campaign] = await db.select().from(tenantReferralCampaignsTable).where(eq(tenantReferralCampaignsTable.id, conv.campaignId));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  // Issue rewards
  if (campaign.rewardForReferrer && conv.referrerCustomerId) {
    await db.insert(tenantReferralRewardsTable).values({
      tenantId,
      conversionId: conv.id,
      customerId: conv.referrerCustomerId,
      kind: campaign.rewardType === "cash" ? "cash" : "credit",
      amountPence: campaign.rewardValuePence,
    });
  }
  if (campaign.rewardForReferee && conv.refereeCustomerId) {
    await db.insert(tenantReferralRewardsTable).values({
      tenantId,
      conversionId: conv.id,
      customerId: conv.refereeCustomerId,
      kind: campaign.rewardType === "cash" ? "cash" : "discount",
      amountPence: campaign.rewardValuePence,
    });
  }

  const [updated] = await db.update(tenantReferralConversionsTable).set({
    status: "rewarded",
    rewardPence: campaign.rewardValuePence,
    rewardedAt: new Date(),
  }).where(eq(tenantReferralConversionsTable.id, conv.id)).returning();

  const [refRow] = updated.referrerCustomerId
    ? await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, updated.referrerCustomerId))
    : [{ name: null }];

  res.json(({
    id: updated.id,
    campaignName: campaign.name,
    referrerName: refRow?.name ?? null,
    refereeName: updated.refereeName,
    refereeEmail: updated.refereeEmail,
    status: updated.status,
    rewardPence: updated.rewardPence,
    createdAt: updated.createdAt.toISOString(),
    rewardedAt: updated.rewardedAt ? updated.rewardedAt.toISOString() : null,
  }));
});

// ---- Portal "Refer a friend" --------------------------------------------

router.get("/v1/public/portal/:tenantSlug/refer", async (req, res): Promise<void> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, req.params.tenantSlug as string));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  const customerId = req.session?.portalCustomerId;
  if (!customerId || req.session?.portalTenantId !== tenant.id) {
    res.json(({ enabled: false, campaignName: null, description: null, rewardSummary: null, myCode: null, shareUrl: null }));
    return;
  }
  const [campaign] = await db.select().from(tenantReferralCampaignsTable)
    .where(and(eq(tenantReferralCampaignsTable.tenantId, tenant.id), eq(tenantReferralCampaignsTable.active, true)))
    .orderBy(desc(tenantReferralCampaignsTable.createdAt));
  if (!campaign) {
    res.json(({ enabled: false, campaignName: null, description: null, rewardSummary: null, myCode: null, shareUrl: null }));
    return;
  }
  let [code] = await db.select().from(tenantReferralCodesTable)
    .where(and(
      eq(tenantReferralCodesTable.tenantId, tenant.id),
      eq(tenantReferralCodesTable.campaignId, campaign.id),
      eq(tenantReferralCodesTable.customerId, customerId),
    ));
  if (!code) {
    const newCode = genCode();
    const base = process.env.PUBLIC_BASE_URL ?? "";
    const shareUrl = `${base}/portal/${tenant.slug}?refcode=${newCode}`;
    [code] = await db.insert(tenantReferralCodesTable).values({
      tenantId: tenant.id,
      campaignId: campaign.id,
      customerId,
      code: newCode,
      shareUrl,
    }).returning();
  }
  res.json(({
    enabled: true,
    campaignName: campaign.name,
    description: campaign.description ?? null,
    rewardSummary: rewardSummary(campaign),
    myCode: code.code,
    shareUrl: code.shareUrl,
  }));
});

router.post("/v1/public/portal/:tenantSlug/refer", async (req, res): Promise<void> => {
  const parsed = SubmitPortalReferralBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, req.params.tenantSlug as string));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  const customerId = req.session?.portalCustomerId;
  if (!customerId || req.session?.portalTenantId !== tenant.id) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const [campaign] = await db.select().from(tenantReferralCampaignsTable)
    .where(and(eq(tenantReferralCampaignsTable.tenantId, tenant.id), eq(tenantReferralCampaignsTable.active, true)))
    .orderBy(desc(tenantReferralCampaignsTable.createdAt));
  if (!campaign) { res.status(400).json({ error: "No active referral campaign" }); return; }

  let [code] = await db.select().from(tenantReferralCodesTable)
    .where(and(
      eq(tenantReferralCodesTable.tenantId, tenant.id),
      eq(tenantReferralCodesTable.campaignId, campaign.id),
      eq(tenantReferralCodesTable.customerId, customerId),
    ));
  if (!code) {
    [code] = await db.insert(tenantReferralCodesTable).values({
      tenantId: tenant.id,
      campaignId: campaign.id,
      customerId,
      code: genCode(),
    }).returning();
  }

  await db.insert(tenantReferralConversionsTable).values({
    tenantId: tenant.id,
    campaignId: campaign.id,
    codeId: code.id,
    referrerCustomerId: customerId,
    refereeName: parsed.data.name,
    refereeEmail: parsed.data.email ?? null,
    status: "pending",
  });
  await logAudit({ tenantId: tenant.id, kind: "referral.submitted", message: `Customer referral submitted via portal: ${parsed.data.name}` });
  res.json(({ ok: true }));
});

export default router;
