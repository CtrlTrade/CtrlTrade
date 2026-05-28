import { eq, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  industriesTable,
  industryJobTypesTable,
  industryCustomFieldsTable,
  industryChecklistsTable,
  industryQuoteTemplatesTable,
  industryDocumentTemplatesTable,
  tenantJobTypesTable,
  tenantChecklistsTable,
  tenantQuoteTemplatesTable,
  tenantDocumentTemplatesTable,
} from "@workspace/db";

export interface ProvisioningOptions {
  tenantId: string;
  industrySlug?: string;
  hasTradeShop?: boolean;
  hasMobileWorkforce?: boolean;
  appointmentBookingEnabled?: boolean;
  multiBranchEnabled?: boolean;
  posEnabled?: boolean;
  aiModulesEnabled?: string[];
  communicationChannels?: string[];
}

type Tx = Parameters<Parameters<typeof db["transaction"]>[0]>[0];

export async function getIndustryBySlug(slug: string) {
  const [industry] = await db
    .select()
    .from(industriesTable)
    .where(eq(industriesTable.slug, slug));
  return industry ?? null;
}

export async function getIndustryDetailById(industryId: string) {
  const [industry] = await db
    .select()
    .from(industriesTable)
    .where(eq(industriesTable.id, industryId));
  if (!industry) return null;

  const [jobTypes, customFields, checklists, quoteTemplates, documentTemplates] = await Promise.all([
    db.select().from(industryJobTypesTable).where(eq(industryJobTypesTable.industryId, industryId)),
    db.select().from(industryCustomFieldsTable).where(eq(industryCustomFieldsTable.industryId, industryId)),
    db.select().from(industryChecklistsTable).where(eq(industryChecklistsTable.industryId, industryId)),
    db.select().from(industryQuoteTemplatesTable).where(eq(industryQuoteTemplatesTable.industryId, industryId)),
    db.select().from(industryDocumentTemplatesTable).where(eq(industryDocumentTemplatesTable.industryId, industryId)),
  ]);

  return { industry, jobTypes, customFields, checklists, quoteTemplates, documentTemplates };
}

export async function listAllIndustriesWithDetail() {
  const industries = await db
    .select()
    .from(industriesTable)
    .orderBy(industriesTable.sortOrder);

  const ids = industries.map((i) => i.id);
  if (ids.length === 0) return [];

  const [jobTypes, customFields, checklists, quoteTemplates, documentTemplates] = await Promise.all([
    db.select().from(industryJobTypesTable).where(inArray(industryJobTypesTable.industryId, ids)),
    db.select().from(industryCustomFieldsTable).where(inArray(industryCustomFieldsTable.industryId, ids)),
    db.select().from(industryChecklistsTable).where(inArray(industryChecklistsTable.industryId, ids)),
    db.select().from(industryQuoteTemplatesTable).where(inArray(industryQuoteTemplatesTable.industryId, ids)),
    db.select().from(industryDocumentTemplatesTable).where(inArray(industryDocumentTemplatesTable.industryId, ids)),
  ]);

  return industries.map((ind) => ({
    id: ind.id,
    slug: ind.slug,
    name: ind.name,
    description: ind.description ?? null,
    sortOrder: ind.sortOrder,
    jobTypes: jobTypes.filter((j) => j.industryId === ind.id).sort((a, b) => a.sortOrder - b.sortOrder).map((j) => ({
      id: j.id,
      name: j.name,
      description: j.description ?? null,
      durationHours: j.durationHours ?? null,
      sortOrder: j.sortOrder,
    })),
    customFields: customFields.filter((f) => f.industryId === ind.id).sort((a, b) => a.sortOrder - b.sortOrder).map((f) => ({
      id: f.id,
      label: f.label,
      fieldType: f.fieldType,
      required: f.required,
      sortOrder: f.sortOrder,
    })),
    checklists: checklists.filter((c) => c.industryId === ind.id).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      items: (c.items as string[]) ?? [],
      sortOrder: c.sortOrder,
    })),
    quoteTemplates: quoteTemplates.filter((q) => q.industryId === ind.id).sort((a, b) => a.sortOrder - b.sortOrder).map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description ?? null,
      notes: q.notes ?? null,
      sortOrder: q.sortOrder,
    })),
    documentTemplates: documentTemplates.filter((d) => d.industryId === ind.id).sort((a, b) => a.sortOrder - b.sortOrder).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? null,
      documentType: d.documentType,
      required: d.required,
      sortOrder: d.sortOrder,
    })),
  }));
}

async function insertIndustryContentWithExecutor(
  executor: Tx | typeof db,
  tenantId: string,
  detail: NonNullable<Awaited<ReturnType<typeof getIndustryDetailById>>>,
): Promise<void> {
  const { jobTypes, checklists, quoteTemplates, documentTemplates } = detail;

  if (jobTypes.length > 0) {
    await executor.insert(tenantJobTypesTable).values(
      jobTypes.map((jt) => ({
        tenantId,
        name: jt.name,
        description: jt.description ?? null,
        durationHours: jt.durationHours ?? null,
        sortOrder: jt.sortOrder,
        sourceIndustryJobTypeId: jt.id,
      })),
    );
  }

  if (checklists.length > 0) {
    await executor.insert(tenantChecklistsTable).values(
      checklists.map((c) => ({
        tenantId,
        name: c.name,
        description: c.description ?? null,
        items: (c.items as string[]) ?? [],
        sortOrder: c.sortOrder,
        sourceIndustryChecklistId: c.id,
      })),
    );
  }

  if (quoteTemplates.length > 0) {
    await executor.insert(tenantQuoteTemplatesTable).values(
      quoteTemplates.map((qt) => ({
        tenantId,
        name: qt.name,
        description: qt.description ?? null,
        header: qt.header ?? null,
        footer: qt.footer ?? null,
        notes: qt.notes ?? null,
        lineItems: qt.lineItems,
        sortOrder: qt.sortOrder,
        sourceIndustryQuoteTemplateId: qt.id,
      })),
    );
  }

  if (documentTemplates.length > 0) {
    await executor.insert(tenantDocumentTemplatesTable).values(
      documentTemplates.map((dt) => ({
        tenantId,
        name: dt.name,
        description: dt.description ?? null,
        documentType: dt.documentType,
        templateBody: dt.templateBody ?? null,
        required: dt.required,
        sortOrder: dt.sortOrder,
        sourceIndustryDocumentTemplateId: dt.id,
      })),
    );
  }
}

/**
 * Copy industry template content (job types, checklists, quote templates,
 * document templates) into a tenant's own workspace tables.
 *
 * Called within the signup transaction via `copyIndustryContentToTenant()`.
 * Can also be called standalone for re-provisioning when a tenant changes industry.
 */
export async function provisionTenantIndustry(opts: ProvisioningOptions): Promise<void> {
  const { tenantId, industrySlug } = opts;

  if (!industrySlug) return;

  const industry = await getIndustryBySlug(industrySlug);
  if (!industry) return;

  const detail = await getIndustryDetailById(industry.id);
  if (!detail) return;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) return;

  await db.update(tenantsTable)
    .set({ industryId: industry.id })
    .where(eq(tenantsTable.id, tenantId));

  await insertIndustryContentWithExecutor(db, tenantId, detail);
}

/**
 * Copy industry template content into the tenant's workspace within an existing
 * Drizzle transaction. The caller is responsible for having already resolved the
 * industry detail and setting industryId on the tenant within the same transaction.
 */
export async function copyIndustryContentToTenant(
  tx: Tx,
  tenantId: string,
  detail: NonNullable<Awaited<ReturnType<typeof getIndustryDetailById>>>,
): Promise<void> {
  await insertIndustryContentWithExecutor(tx, tenantId, detail);
}

export function serializeIndustryDetail(detail: NonNullable<Awaited<ReturnType<typeof getIndustryDetailById>>>) {
  return {
    id: detail.industry.id,
    slug: detail.industry.slug,
    name: detail.industry.name,
    description: detail.industry.description ?? null,
    sortOrder: detail.industry.sortOrder,
    jobTypes: detail.jobTypes.sort((a, b) => a.sortOrder - b.sortOrder).map((j) => ({
      id: j.id,
      name: j.name,
      description: j.description ?? null,
      durationHours: j.durationHours ?? null,
      sortOrder: j.sortOrder,
    })),
    customFields: detail.customFields.sort((a, b) => a.sortOrder - b.sortOrder).map((f) => ({
      id: f.id,
      label: f.label,
      fieldType: f.fieldType,
      required: f.required,
      sortOrder: f.sortOrder,
    })),
    checklists: detail.checklists.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      items: (c.items as string[]) ?? [],
      sortOrder: c.sortOrder,
    })),
    quoteTemplates: detail.quoteTemplates.sort((a, b) => a.sortOrder - b.sortOrder).map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description ?? null,
      notes: q.notes ?? null,
      sortOrder: q.sortOrder,
    })),
    documentTemplates: detail.documentTemplates.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? null,
      documentType: d.documentType,
      required: d.required,
      sortOrder: d.sortOrder,
    })),
  };
}
