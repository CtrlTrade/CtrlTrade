import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  tenantsTable,
  industriesTable,
  industryJobTypesTable,
  industryChecklistsTable,
  industryDocumentTemplatesTable,
  tenantTypesTable,
} from "@workspace/db";
import { requireSuperAdmin, requireTenant } from "../middlewares/auth";
import {
  listAllIndustriesWithDetail,
  getIndustryDetailById,
  getIndustryBySlug,
  serializeIndustryDetail,
} from "../lib/industryProvisioning";
import {
  AdminAddIndustryJobTypeBody,
  AdminAddIndustryChecklistBody,
  AdminAddIndustryDocumentTemplateBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/tenant-types", async (_req, res): Promise<void> => {
  const types = await db
    .select()
    .from(tenantTypesTable)
    .orderBy(tenantTypesTable.categorySlug, tenantTypesTable.sortOrder);

  const groupMap = new Map<string, { category: string; categorySlug: string; types: typeof types }>();
  for (const t of types) {
    if (!groupMap.has(t.categorySlug)) {
      groupMap.set(t.categorySlug, { category: t.category, categorySlug: t.categorySlug, types: [] });
    }
    groupMap.get(t.categorySlug)!.types.push(t);
  }

  res.json(
    Array.from(groupMap.values()).map((g) => ({
      category: g.category,
      categorySlug: g.categorySlug,
      types: g.types.map((t) => ({
        slug: t.slug,
        name: t.name,
        category: t.category,
        categorySlug: t.categorySlug,
        sortOrder: t.sortOrder,
        industrySlug: (t as any).industrySlug ?? null,
        defaultModules: t.defaultModules ?? {},
      })),
    })),
  );
});

router.get("/v1/industries", async (_req, res): Promise<void> => {
  const industries = await db
    .select()
    .from(industriesTable)
    .orderBy(industriesTable.sortOrder);
  res.json(
    industries.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      description: i.description ?? null,
      icon: i.icon ?? null,
      sortOrder: i.sortOrder,
    })),
  );
});

router.get("/v1/industries/:slug", async (req, res): Promise<void> => {
  const ind = await getIndustryBySlug(req.params.slug);
  if (!ind) {
    res.status(404).json({ error: "Industry not found" });
    return;
  }
  const detail = await getIndustryDetailById(ind.id);
  if (!detail) {
    res.status(404).json({ error: "Industry not found" });
    return;
  }
  res.json(serializeIndustryDetail(detail));
});

router.get("/v1/tenant/modules", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  let industrySlug: string | null = null;
  if (tenant.industryId) {
    const [ind] = await db
      .select({ slug: industriesTable.slug })
      .from(industriesTable)
      .where(eq(industriesTable.id, tenant.industryId));
    industrySlug = ind?.slug ?? null;
  }
  res.json({
    industrySlug,
    businessType: tenant.businessType ?? null,
    hasTradeShop: tenant.hasTradeShop,
    hasMobileWorkforce: tenant.hasMobileWorkforce,
    appointmentBookingEnabled: tenant.appointmentBookingEnabled,
    multiBranchEnabled: tenant.multiBranchEnabled,
    vatRegistered: tenant.vatRegistered,
    accountingProvider: tenant.accountingProvider ?? null,
    aiModulesEnabled: tenant.aiModulesEnabled ?? [],
    communicationChannels: tenant.communicationChannels ?? [],
    posEnabled: tenant.posEnabled,
  });
});

router.patch("/v1/tenant/modules", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = req.body as {
    industrySlug?: string;
    businessType?: string;
    hasTradeShop?: boolean;
    hasMobileWorkforce?: boolean;
    appointmentBookingEnabled?: boolean;
    multiBranchEnabled?: boolean;
    vatRegistered?: boolean;
    accountingProvider?: string;
    aiModulesEnabled?: string[];
    communicationChannels?: string[];
    posEnabled?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (body.businessType !== undefined) updates.businessType = body.businessType;
  if (body.hasTradeShop !== undefined) updates.hasTradeShop = body.hasTradeShop;
  if (body.hasMobileWorkforce !== undefined) updates.hasMobileWorkforce = body.hasMobileWorkforce;
  if (body.appointmentBookingEnabled !== undefined) updates.appointmentBookingEnabled = body.appointmentBookingEnabled;
  if (body.multiBranchEnabled !== undefined) updates.multiBranchEnabled = body.multiBranchEnabled;
  if (body.vatRegistered !== undefined) updates.vatRegistered = body.vatRegistered;
  if (body.accountingProvider !== undefined) updates.accountingProvider = body.accountingProvider;
  if (body.aiModulesEnabled !== undefined) updates.aiModulesEnabled = body.aiModulesEnabled;
  if (body.communicationChannels !== undefined) updates.communicationChannels = body.communicationChannels;
  if (body.posEnabled !== undefined) updates.posEnabled = body.posEnabled;

  if (body.industrySlug !== undefined) {
    const [ind] = await db
      .select()
      .from(industriesTable)
      .where(eq(industriesTable.slug, body.industrySlug));
    if (ind) updates.industryId = ind.id;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, tenantId));
  }

  const [updated] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  let industrySlug: string | null = null;
  if (updated.industryId) {
    const [ind] = await db
      .select({ slug: industriesTable.slug })
      .from(industriesTable)
      .where(eq(industriesTable.id, updated.industryId));
    industrySlug = ind?.slug ?? null;
  }

  res.json({
    industrySlug,
    businessType: updated.businessType ?? null,
    hasTradeShop: updated.hasTradeShop,
    hasMobileWorkforce: updated.hasMobileWorkforce,
    appointmentBookingEnabled: updated.appointmentBookingEnabled,
    multiBranchEnabled: updated.multiBranchEnabled,
    vatRegistered: updated.vatRegistered,
    accountingProvider: updated.accountingProvider ?? null,
    aiModulesEnabled: updated.aiModulesEnabled ?? [],
    communicationChannels: updated.communicationChannels ?? [],
    posEnabled: updated.posEnabled,
  });
});

router.get("/v1/admin/industries", requireSuperAdmin, async (_req, res): Promise<void> => {
  const detail = await listAllIndustriesWithDetail();
  res.json(detail);
});

router.post("/v1/admin/industries/:id/job-types", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = AdminAddIndustryJobTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const industryId = String(req.params.id);
  await db.insert(industryJobTypesTable).values({
    industryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    durationHours: parsed.data.durationHours ?? null,
  });
  const detail = await getIndustryDetailById(industryId);
  res.status(201).json(detail ? serializeIndustryDetail(detail) : {});
});

router.delete("/v1/admin/industries/:id/job-types/:itemId", requireSuperAdmin, async (req, res): Promise<void> => {
  await db.delete(industryJobTypesTable).where(eq(industryJobTypesTable.id, String(req.params.itemId)));
  res.status(204).end();
});

router.post("/v1/admin/industries/:id/checklists", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = AdminAddIndustryChecklistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const industryId = String(req.params.id);
  await db.insert(industryChecklistsTable).values({
    industryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    items: parsed.data.items,
  });
  const detail = await getIndustryDetailById(industryId);
  res.status(201).json(detail ? serializeIndustryDetail(detail) : {});
});

router.delete("/v1/admin/industries/:id/checklists/:itemId", requireSuperAdmin, async (req, res): Promise<void> => {
  await db.delete(industryChecklistsTable).where(eq(industryChecklistsTable.id, String(req.params.itemId)));
  res.status(204).end();
});

router.post("/v1/admin/industries/:id/document-templates", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = AdminAddIndustryDocumentTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const industryId = String(req.params.id);
  await db.insert(industryDocumentTemplatesTable).values({
    industryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    documentType: parsed.data.documentType,
    required: parsed.data.required ?? false,
  });
  const detail = await getIndustryDetailById(industryId);
  res.status(201).json(detail ? serializeIndustryDetail(detail) : {});
});

router.delete("/v1/admin/industries/:id/document-templates/:itemId", requireSuperAdmin, async (req, res): Promise<void> => {
  await db.delete(industryDocumentTemplatesTable).where(eq(industryDocumentTemplatesTable.id, String(req.params.itemId)));
  res.status(204).end();
});

export default router;
