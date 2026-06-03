import { eq, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  subscriptionsTable,
  tenantTradeCategoriesTable,
  tradeCategoriesTable,
  industriesTable,
  type Tenant,
  type User,
  type SubscriptionRow,
  type Membership,
} from "@workspace/db";
import { computeMonthlyTotal } from "./pricing";

export async function getTradeCategorySlugs(tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: tradeCategoriesTable.slug })
    .from(tenantTradeCategoriesTable)
    .innerJoin(
      tradeCategoriesTable,
      eq(tradeCategoriesTable.id, tenantTradeCategoriesTable.tradeCategoryId),
    )
    .where(eq(tenantTradeCategoriesTable.tenantId, tenantId));
  return rows.map((r) => r.slug);
}

export async function serializeTenant(t: Tenant) {
  const slugs = await getTradeCategorySlugs(t.id);
  let industrySlug: string | null = null;
  if (t.industryId) {
    const [ind] = await db
      .select({ slug: industriesTable.slug })
      .from(industriesTable)
      .where(eq(industriesTable.id, t.industryId));
    industrySlug = ind?.slug ?? null;
  }
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    country: t.country,
    phone: t.phone,
    addressLine1: t.addressLine1,
    city: t.city,
    postcode: t.postcode,
    industryId: t.industryId ?? null,
    industrySlug,
    businessType: t.businessType ?? null,
    website: t.website ?? null,
    contactName: t.contactName ?? null,
    vatNumber: t.vatNumber ?? null,
    hasTradeShop: t.hasTradeShop,
    hasMobileWorkforce: t.hasMobileWorkforce,
    appointmentBookingEnabled: t.appointmentBookingEnabled,
    multiBranchEnabled: t.multiBranchEnabled,
    vatRegistered: t.vatRegistered,
    accountingProvider: t.accountingProvider ?? null,
    aiModulesEnabled: t.aiModulesEnabled ?? [],
    communicationChannels: t.communicationChannels ?? [],
    posEnabled: t.posEnabled,
    brandColor: t.brandColor,
    logoUrl: t.logoUrl,
    logoPortalUrl: t.logoPortalUrl,
    logoPosUrl: t.logoPosUrl,
    faviconUrl: t.faviconUrl,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    surfaceColor: t.surfaceColor,
    fontFamily: t.fontFamily,
    brandTemplates: t.brandTemplates ?? null,
    leadCaptureAllowedOrigins: t.leadCaptureAllowedOrigins ?? [],
    tradeCategorySlugs: slugs,
    parentTenantId: t.parentTenantId ?? null,
    require2fa: t.require2fa,
    tenantType: t.tenantType ?? null,
    tenantCategory: t.tenantCategory ?? null,
    whiteLabelConfig: t.whiteLabelConfig ?? null,
  };
}

export function serializeUser(user: User, membership: Membership | null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership?.role ?? (user.isSuperAdmin ? "super_admin" : "guest"),
    isSuperAdmin: user.isSuperAdmin,
    totpEnabled: user.totpEnabled,
    seatType: membership?.seatType ?? null,
  };
}

export function serializeSubscription(s: SubscriptionRow) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    status: s.status,
    controlSeats: s.controlSeats,
    fieldSeats: s.fieldSeats,
    tills: s.tills,
    currency: s.currency,
    monthlyTotal: computeMonthlyTotal(s.controlSeats, s.fieldSeats, s.tills),
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    stripeCustomerId: s.stripeCustomerId,
    stripeSubscriptionId: s.stripeSubscriptionId,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  };
}

export async function getTenantSubscription(tenantId: string): Promise<SubscriptionRow | null> {
  const [s] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.tenantId, tenantId));
  return s ?? null;
}

export function totals(rows: SubscriptionRow[]) {
  let controlSeats = 0;
  let fieldSeats = 0;
  let tills = 0;
  let monthlyTotal = 0;
  for (const r of rows) {
    if (r.status === "active" || r.status === "trial") {
      controlSeats += r.controlSeats;
      fieldSeats += r.fieldSeats;
      tills += r.tills;
      monthlyTotal += computeMonthlyTotal(r.controlSeats, r.fieldSeats, r.tills);
    }
  }
  return { controlSeats, fieldSeats, tills, monthlyTotal };
}

export const sqlHelpers = { sql };
