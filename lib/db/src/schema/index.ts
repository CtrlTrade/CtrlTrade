import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---- Trade categories (global reference) ----------------------------------
export const tradeCategoriesTable = pgTable("trade_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  jobTypes: text("job_types").array().notNull().default(sql`'{}'::text[]`),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Industries (global reference) ----------------------------------------
export const industriesTable = pgTable("industries", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 32 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const industryJobTypesTable = pgTable("industry_job_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  industryId: uuid("industry_id").notNull().references(() => industriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  durationHours: integer("duration_hours"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ industryIdx: index("industry_job_types_industry_idx").on(t.industryId) }));

export const industryCustomFieldsTable = pgTable("industry_custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  industryId: uuid("industry_id").notNull().references(() => industriesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fieldType: varchar("field_type", { length: 32 }).notNull().default("text"),
  options: jsonb("options"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ industryIdx: index("industry_custom_fields_industry_idx").on(t.industryId) }));

export const industryChecklistsTable = pgTable("industry_checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  industryId: uuid("industry_id").notNull().references(() => industriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ industryIdx: index("industry_checklists_industry_idx").on(t.industryId) }));

export const industryQuoteTemplatesTable = pgTable("industry_quote_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  industryId: uuid("industry_id").notNull().references(() => industriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  header: text("header"),
  footer: text("footer"),
  notes: text("notes"),
  lineItems: jsonb("line_items").notNull().default(sql`'[]'::jsonb`).$type<Array<{ description: string; quantity: number; unitPricePence: number }>>(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ industryIdx: index("industry_quote_templates_industry_idx").on(t.industryId) }));

export const industryDocumentTemplatesTable = pgTable("industry_document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  industryId: uuid("industry_id").notNull().references(() => industriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  documentType: varchar("document_type", { length: 64 }).notNull(),
  templateBody: text("template_body"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ industryIdx: index("industry_document_templates_industry_idx").on(t.industryId) }));

export type Industry = typeof industriesTable.$inferSelect;
export type IndustryJobType = typeof industryJobTypesTable.$inferSelect;
export type IndustryCustomField = typeof industryCustomFieldsTable.$inferSelect;
export type IndustryChecklist = typeof industryChecklistsTable.$inferSelect;
export type IndustryQuoteTemplate = typeof industryQuoteTemplatesTable.$inferSelect;
export type IndustryDocumentTemplate = typeof industryDocumentTemplatesTable.$inferSelect;

// ---- Tenants ---------------------------------------------------------------
export const tenantsTable = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    status: varchar("status", { length: 32 }).notNull().default("trial"), // trial|active|past_due|paused|cancelled
    country: text("country"),
    phone: text("phone"),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    companyNumber: text("company_number"),
    // Industry-aware provisioning fields
    industryId: uuid("industry_id").references(() => industriesTable.id, { onDelete: "set null" }),
    businessType: varchar("business_type", { length: 32 }),
    website: text("website"),
    contactName: text("contact_name"),
    vatNumber: text("vat_number"),
    invoiceNumberFormat: varchar("invoice_number_format", { length: 64 }),
    financialYearStart: varchar("financial_year_start", { length: 8 }),
    hasTradeShop: boolean("has_trade_shop").notNull().default(false),
    hasMobileWorkforce: boolean("has_mobile_workforce").notNull().default(false),
    appointmentBookingEnabled: boolean("appointment_booking_enabled").notNull().default(false),
    multiBranchEnabled: boolean("multi_branch_enabled").notNull().default(false),
    vatRegistered: boolean("vat_registered").notNull().default(false),
    accountingProvider: varchar("accounting_provider", { length: 32 }),
    aiModulesEnabled: jsonb("ai_modules_enabled").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
    communicationChannels: jsonb("communication_channels").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
    posEnabled: boolean("pos_enabled").notNull().default(false),
    brandColor: varchar("brand_color", { length: 16 }),
    logoUrl: text("logo_url"),
    logoPortalUrl: text("logo_portal_url"),
    logoPosUrl: text("logo_pos_url"),
    faviconUrl: text("favicon_url"),
    primaryColor: varchar("primary_color", { length: 16 }),
    accentColor: varchar("accent_color", { length: 16 }),
    surfaceColor: varchar("surface_color", { length: 16 }),
    fontFamily: varchar("font_family", { length: 64 }),
    brandTemplates: jsonb("brand_templates").$type<{
      invoice?: { header?: string; footer?: string; notes?: string };
      quote?: { header?: string; footer?: string; notes?: string };
      email?: { signature?: string; header?: string };
      posReceipt?: { header?: string; footer?: string };
    }>(),
    verifiedBadge: boolean("verified_badge").notNull().default(false),
    badgeAwardedAt: timestamp("badge_awarded_at", { withTimezone: true }),
    parentTenantId: uuid("parent_tenant_id"),
    whiteLabelConfig: jsonb("white_label_config").$type<{
      hideCtrlTradeBranding?: boolean;
      productName?: string;
      supportEmail?: string;
      supportPhone?: string;
      outboundEmailDomain?: string;
      outboundFromName?: string;
      outboundFromEmail?: string;
      dkimVerified?: boolean;
      legalEntity?: string;
    }>(),
    leadCaptureAllowedOrigins: text("lead_capture_allowed_origins").array().notNull().default(sql`'{}'::text[]`),
    bookingWidgetConfig: jsonb("booking_widget_config").$type<{
      active?: boolean;
      jobTypes?: string[];
      showDateField?: boolean;
      thankYouMessage?: string;
    }>(),
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
    invoiceNumberSeq: integer("invoice_number_seq").notNull().default(0),
    quoteNumberSeq: integer("quote_number_seq").notNull().default(0),
    jobNumberSeq: integer("job_number_seq").notNull().default(0),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    require2fa: boolean("require_2fa").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("tenants_status_idx").on(t.status),
    stripeCustIdx: index("tenants_stripe_customer_idx").on(t.stripeCustomerId),
    parentIdx: index("tenants_parent_idx").on(t.parentTenantId),
  }),
);

// ---- Custom domains (Host header routing) ---------------------------------
export const customDomainsTable = pgTable(
  "custom_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    hostname: varchar("hostname", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull().default("portal"), // portal|app
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending|verified|failed
    verificationToken: varchar("verification_token", { length: 128 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqHost: uniqueIndex("custom_domains_hostname_uniq").on(t.hostname),
    tenantIdx: index("custom_domains_tenant_idx").on(t.tenantId),
  }),
);

// ---- Reseller profiles (a tenant flagged as a reseller / franchise parent)
export const resellerProfilesTable = pgTable(
  "reseller_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }).unique(),
    displayName: text("display_name"),
    contactEmail: varchar("contact_email", { length: 255 }),
    revenueSharePct: integer("revenue_share_pct").notNull().default(0),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
);

export type CustomDomain = typeof customDomainsTable.$inferSelect;
export type ResellerProfile = typeof resellerProfilesTable.$inferSelect;

// ---- Users (global; can belong to multiple tenants) -----------------------
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active|disabled
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpRecoveryCodesEnc: text("totp_recovery_codes_enc"),
  totpEnrolledAt: timestamp("totp_enrolled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---- Tenant memberships (user x tenant) -----------------------------------
export const membershipsTable = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(), // owner|admin|manager|staff
    seatType: varchar("seat_type", { length: 16 }).notNull(), // control|field
    status: varchar("status", { length: 16 }).notNull().default("active"), // active|disabled
    branchId: uuid("branch_id"),
    defaultHourlyRatePence: integer("default_hourly_rate_pence"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique("memberships_tenant_user_uniq").on(t.tenantId, t.userId),
    tenantIdx: index("memberships_tenant_idx").on(t.tenantId),
    userIdx: index("memberships_user_idx").on(t.userId),
  }),
);

// ---- Invitations (magic-link invite to join a tenant) ---------------------
export const invitationsTable = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    seatType: varchar("seat_type", { length: 16 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    invitedByUserId: uuid("invited_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("invitations_tenant_idx").on(t.tenantId),
    emailIdx: index("invitations_email_idx").on(t.tenantId, t.email),
  }),
);

// ---- Password reset tokens -------------------------------------------------
export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("password_reset_user_idx").on(t.userId),
  }),
);

// ---- Tenant GDPR deletion requests ----------------------------------------
export const tenantDeletionRequestsTable = pgTable(
  "tenant_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    requestedByLabel: text("requested_by_label"),
    reason: text("reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    scheduledPurgeAt: timestamp("scheduled_purge_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("pending"), // pending|cancelled|purged
  },
  (t) => ({
    tenantIdx: uniqueIndex("tenant_deletion_active_idx")
      .on(t.tenantId)
      .where(sql`status = 'pending'`),
  }),
);

// ---- Tenant trade category join -------------------------------------------
export const tenantTradeCategoriesTable = pgTable(
  "tenant_trade_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    tradeCategoryId: uuid("trade_category_id").notNull().references(() => tradeCategoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: unique("tenant_trade_uniq").on(t.tenantId, t.tradeCategoryId),
    tenantIdx: index("tenant_trade_tenant_idx").on(t.tenantId),
  }),
);

// ---- Subscription mirror (Stripe is source of truth) ---------------------
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }).unique(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    status: varchar("status", { length: 32 }).notNull(), // trialing|active|past_due|canceled|paused
    controlSeats: integer("control_seats").notNull().default(0),
    fieldSeats: integer("field_seats").notNull().default(0),
    tills: integer("tills").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("subs_tenant_idx").on(t.tenantId),
    statusIdx: index("subs_status_idx").on(t.status),
  }),
);

// ---- Audit log -------------------------------------------------------------
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    kind: varchar("kind", { length: 64 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("audit_tenant_idx").on(t.tenantId),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  }),
);

// ---- Layer-2 scaffolding tables (defined, not yet used) -------------------
export const usageEventsTable = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 64 }).notNull(),
  amount: integer("amount").notNull().default(1),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("usage_tenant_idx").on(t.tenantId) }));

export const featureFlagsTable = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  rolloutPct: integer("rollout_pct").notNull().default(100),
  description: text("description"),
  value: jsonb("value"),
  updatedByUserId: uuid("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("ff_tenant_idx").on(t.tenantId),
  uniqGlobal: uniqueIndex("ff_global_key_uniq").on(t.key).where(sql`tenant_id IS NULL`),
  uniqTenant: uniqueIndex("ff_tenant_key_uniq").on(t.tenantId, t.key).where(sql`tenant_id IS NOT NULL`),
}));

export const notificationDeliveriesTable = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 32 }).notNull(),
  template: varchar("template", { length: 64 }).notNull(),
  subjectKind: varchar("subject_kind", { length: 32 }),
  subjectId: uuid("subject_id"),
  jobId: uuid("job_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  subject: text("subject"),
  payload: jsonb("payload"),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  providerMessageId: text("provider_message_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("notif_tenant_idx").on(t.tenantId) }));

// Registry of notification event kinds. Mirrors the in-code NOTIFICATION_EVENTS
// constant in lib/notifications.ts; seeded at boot. Operators can see this list
// when configuring preferences or templates.
export const notificationEventsTable = pgTable("notification_events", {
  kind: varchar("kind", { length: 64 }).primaryKey(),
  description: text("description").notNull(),
  defaultChannels: text("default_channels").array().notNull().default(sql`'{}'::text[]`),
  category: varchar("category", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const filesTable = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  parentKind: varchar("parent_kind", { length: 32 }),
  parentId: uuid("parent_id"),
  name: text("name"),
  label: text("label"),
  mimeType: varchar("mime_type", { length: 128 }),
  sizeBytes: integer("size_bytes"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  uploadedByLabel: text("uploaded_by_label"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("files_tenant_idx").on(t.tenantId),
  parentIdx: index("files_parent_idx").on(t.tenantId, t.parentKind, t.parentId),
}));

export type FileRow = typeof filesTable.$inferSelect;

// ---- Worker queue ----------------------------------------------------------
export const workerJobsTable = pgTable("worker_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 64 }).notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  status: varchar("status", { length: 16 }).notNull().default("queued"), // queued|running|done|failed|dead
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastError: text("last_error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  scheduleKey: varchar("schedule_key", { length: 64 }),
  uniqKey: varchar("uniq_key", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  statusRunIdx: index("worker_jobs_status_run_idx").on(t.status, t.runAt),
  kindIdx: index("worker_jobs_kind_idx").on(t.kind),
  uniqKeyIdx: uniqueIndex("worker_jobs_uniq_key_idx").on(t.uniqKey).where(sql`uniq_key IS NOT NULL`),
}));

export type WorkerJob = typeof workerJobsTable.$inferSelect;

// ---- Usage metering --------------------------------------------------------
export const usageCountersTable = pgTable("usage_counters", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 64 }).notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(), // hour bucket
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniq: uniqueIndex("usage_counters_uniq").on(t.tenantId, t.kind, t.periodStart),
  tenantIdx: index("usage_counters_tenant_idx").on(t.tenantId),
}));

export const tenantUsageSummaryTable = pgTable("tenant_usage_summary", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 64 }).notNull(),
  day: timestamp("day", { withTimezone: true }).notNull(), // UTC midnight
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("tenant_usage_summary_uniq").on(t.tenantId, t.kind, t.day),
  tenantIdx: index("tenant_usage_summary_tenant_idx").on(t.tenantId),
}));

// ============================================================================
// Layer 2 — tenant workspace domain tables
// ============================================================================

// ---- Customers -------------------------------------------------------------
export const customersTable = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: text("phone"),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    notes: text("notes"),
    branchId: uuid("branch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("customers_tenant_idx").on(t.tenantId),
    branchIdx: index("customers_branch_idx").on(t.branchId),
  }),
);

// ---- Quotes ----------------------------------------------------------------
export const quotesTable = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
    number: varchar("number", { length: 32 }).notNull(),
    title: text("title").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"), // draft|sent|accepted|declined|converted
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    notes: text("notes"),
    depositPct: integer("deposit_pct").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    convertedJobId: uuid("converted_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("quotes_tenant_idx").on(t.tenantId),
    statusIdx: index("quotes_status_idx").on(t.status),
    uniqNum: unique("quotes_tenant_number_uniq").on(t.tenantId, t.number),
  }),
);

export const quoteLineItemsTable = pgTable(
  "quote_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").notNull().references(() => quotesTable.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPricePence: integer("unit_price_pence").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    quoteIdx: index("quote_items_quote_idx").on(t.quoteId),
  }),
);

// ---- Projects --------------------------------------------------------------
export const projectsTable = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("planning"), // planning|active|completed|cancelled
    description: text("description"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("projects_tenant_idx").on(t.tenantId),
    statusIdx: index("projects_status_idx").on(t.status),
  }),
);

export type Project = typeof projectsTable.$inferSelect;

// ---- Jobs + scheduling -----------------------------------------------------
export const jobsTable = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    number: varchar("number", { length: 32 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: varchar("status", { length: 24 }).notNull().default("scheduled"), // scheduled|in_progress|completed|cancelled
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    assignedUserId: uuid("assigned_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    assignedVehicleId: uuid("assigned_vehicle_id"),
    valuePence: integer("value_pence").notNull().default(0),
    parentContractId: uuid("parent_contract_id"),
    recurrenceIndex: integer("recurrence_index"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    signoffImageUrl: text("signoff_image_url"),
    signoffName: text("signoff_name"),
    signoffAt: timestamp("signoff_at", { withTimezone: true }),
    signoffNote: text("signoff_note"),
    branchId: uuid("branch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("jobs_tenant_idx").on(t.tenantId),
    statusIdx: index("jobs_status_idx").on(t.status),
    scheduleIdx: index("jobs_schedule_idx").on(t.tenantId, t.scheduledStart),
    assignedIdx: index("jobs_assigned_idx").on(t.assignedUserId),
    contractIdx: index("jobs_contract_idx").on(t.parentContractId),
    projectIdx: index("jobs_project_idx").on(t.projectId),
    uniqNum: unique("jobs_tenant_number_uniq").on(t.tenantId, t.number),
    branchIdx: index("jobs_branch_idx").on(t.branchId),
  }),
);

// ---- Maintenance Contracts -------------------------------------------------
export const maintenanceContractsTable = pgTable(
  "maintenance_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    frequency: varchar("frequency", { length: 24 }).notNull(), // weekly|fortnightly|monthly|quarterly|annually
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    occurrences: integer("occurrences"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("active"), // active|paused|cancelled|completed
    pricePence: integer("price_pence").notNull().default(0),
    notes: text("notes"),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    jobsGenerated: integer("jobs_generated").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("contracts_tenant_idx").on(t.tenantId),
    customerIdx: index("contracts_customer_idx").on(t.tenantId, t.customerId),
    nextDueIdx: index("contracts_next_due_idx").on(t.status, t.nextDueAt),
  }),
);

export type MaintenanceContract = typeof maintenanceContractsTable.$inferSelect;

// ---- Fleet -----------------------------------------------------------------
export const vehiclesTable = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    registration: varchar("registration", { length: 32 }).notNull(),
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    motDueAt: timestamp("mot_due_at", { withTimezone: true }),
    taxDueAt: timestamp("tax_due_at", { withTimezone: true }),
    serviceDueAt: timestamp("service_due_at", { withTimezone: true }),
    assignedDriverId: uuid("assigned_driver_id").references(() => usersTable.id, { onDelete: "set null" }),
    status: varchar("status", { length: 24 }).notNull().default("active"), // active|maintenance|retired
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("vehicles_tenant_idx").on(t.tenantId),
    uniqReg: unique("vehicles_tenant_reg_uniq").on(t.tenantId, t.registration),
  }),
);

export const vehicleLocationsTable = pgTable(
  "vehicle_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
    lat: text("lat").notNull(),
    lng: text("lng").notNull(),
    speedKph: integer("speed_kph"),
    headingDeg: integer("heading_deg"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("vlocs_tenant_idx").on(t.tenantId),
    vehicleIdx: index("vlocs_vehicle_idx").on(t.vehicleId, t.recordedAt),
  }),
);

// ---- Compliance / certificates --------------------------------------------
// ---- Verification submissions (CtrlTrade Verified badge) ------------------
export const verificationSubmissionsTable = pgTable(
  "verification_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("pending"), // pending|approved|rejected
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("verif_sub_tenant_idx").on(t.tenantId),
    statusIdx: index("verif_sub_status_idx").on(t.status),
  }),
);

export const verificationDocumentsTable = pgTable(
  "verification_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").notNull().references(() => verificationSubmissionsTable.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id").notNull().references(() => certificatesTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    submissionIdx: index("verif_doc_submission_idx").on(t.submissionId),
    certIdx: index("verif_doc_cert_idx").on(t.certificateId),
  }),
);

export type VerificationSubmission = typeof verificationSubmissionsTable.$inferSelect;
export type VerificationDocument = typeof verificationDocumentsTable.$inferSelect;

export const certificatesTable = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    holderUserId: uuid("holder_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    holderLabel: text("holder_label"),
    kind: varchar("kind", { length: 64 }).notNull(), // gas_safe|niceic|cscs|first_aid|insurance|other
    reference: text("reference"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    documentUrl: text("document_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("certs_tenant_idx").on(t.tenantId),
    expiresIdx: index("certs_expires_idx").on(t.tenantId, t.expiresAt),
  }),
);

// ---- POS sales (CtrlTradePos till) ----------------------------------------
export const posSalesTable = pgTable(
  "pos_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
    jobReference: text("job_reference"),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    lines: jsonb("lines").notNull(),
    subtotal: integer("subtotal_pence").notNull(),
    taxAmount: integer("tax_pence").notNull(),
    total: integer("total_pence").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    tender: varchar("tender", { length: 16 }).notNull(),
    notes: text("notes"),
    receiptDeliveredAt: timestamp("receipt_delivered_at", { withTimezone: true }),
    receiptMethod: varchar("receipt_method", { length: 16 }),
    receiptDestination: text("receipt_destination"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("pos_sales_tenant_idx").on(t.tenantId),
    createdIdx: index("pos_sales_created_idx").on(t.createdAt),
  }),
);

// ---- Invoices --------------------------------------------------------------
export const invoicesTable = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
    jobId: uuid("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
    number: varchar("number", { length: 32 }).notNull(),
    title: text("title").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"), // draft|sent|paid|void
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    subtotalPence: integer("subtotal_pence").notNull().default(0),
    taxPence: integer("tax_pence").notNull().default(0),
    totalPence: integer("total_pence").notNull().default(0),
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
    isDeposit: boolean("is_deposit").notNull().default(false),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    stripePaymentLinkId: text("stripe_payment_link_id"),
    stripePaymentLinkUrl: text("stripe_payment_link_url"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("invoices_tenant_idx").on(t.tenantId),
    statusIdx: index("invoices_status_idx").on(t.status),
    dueIdx: index("invoices_due_idx").on(t.tenantId, t.dueAt),
    uniqNum: unique("invoices_tenant_number_uniq").on(t.tenantId, t.number),
  }),
);

export const invoiceItemsTable = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPricePence: integer("unit_price_pence").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({ invoiceIdx: index("invoice_items_invoice_idx").on(t.invoiceId) }),
);

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
    amountPence: integer("amount_pence").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: varchar("status", { length: 24 }).notNull().default("succeeded"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("payments_tenant_idx").on(t.tenantId),
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
    // Partial unique index — prevents duplicate Stripe webhook deliveries
    // creating two payment rows for the same checkout session. Enforced in DB
    // because the JS dedupe check in recordInvoicePayment is racy.
    stripeSessionUnique: uniqueIndex("payments_stripe_checkout_session_unique")
      .on(t.stripeCheckoutSessionId)
      .where(sql`${t.stripeCheckoutSessionId} IS NOT NULL`),
  }),
);

// ---- Types ----------------------------------------------------------------
export type Tenant = typeof tenantsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Membership = typeof membershipsTable.$inferSelect;
export type TradeCategory = typeof tradeCategoriesTable.$inferSelect;
export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type Customer = typeof customersTable.$inferSelect;
export type Quote = typeof quotesTable.$inferSelect;
export type QuoteLineItem = typeof quoteLineItemsTable.$inferSelect;
export type Job = typeof jobsTable.$inferSelect;
export type Vehicle = typeof vehiclesTable.$inferSelect;
export type VehicleLocation = typeof vehicleLocationsTable.$inferSelect;
export type Certificate = typeof certificatesTable.$inferSelect;
export type PosSale = typeof posSalesTable.$inferSelect;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Invitation = typeof invitationsTable.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
export type TenantDeletionRequest = typeof tenantDeletionRequestsTable.$inferSelect;
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;

// ---- Customer portal -------------------------------------------------------
export const portalTokensTable = pgTable(
  "portal_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("portal_tokens_tenant_idx").on(t.tenantId),
    customerIdx: index("portal_tokens_customer_idx").on(t.customerId),
  }),
);

export const customerMessagesTable = pgTable(
  "customer_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    subjectKind: varchar("subject_kind", { length: 16 }).notNull(), // quote|job|general
    subjectId: uuid("subject_id"),
    fromRole: varchar("from_role", { length: 16 }).notNull(), // customer|staff
    authorUserId: uuid("author_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    authorLabel: text("author_label"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("customer_messages_tenant_idx").on(t.tenantId),
    threadIdx: index("customer_messages_thread_idx").on(t.tenantId, t.subjectKind, t.subjectId),
  }),
);

export const customerReviewsTable = pgTable(
  "customer_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("customer_reviews_tenant_idx").on(t.tenantId),
    jobIdx: index("customer_reviews_job_idx").on(t.jobId),
    uniqJob: unique("customer_reviews_job_uniq").on(t.tenantId, t.jobId),
  }),
);

export type PortalToken = typeof portalTokensTable.$inferSelect;
export type CustomerMessage = typeof customerMessagesTable.$inferSelect;
export type CustomerReview = typeof customerReviewsTable.$inferSelect;

export const invoiceTemplatesTable = pgTable(
  "invoice_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    frequency: varchar("frequency", { length: 16 }).notNull(), // weekly|monthly|quarterly|yearly
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
    items: jsonb("items").notNull().$type<Array<{ description: string; quantity: number; unitPricePence: number }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("invoice_templates_tenant_idx").on(t.tenantId),
    nextIdx: index("invoice_templates_next_idx").on(t.nextRunAt),
  }),
);

export type InvoiceTemplate = typeof invoiceTemplatesTable.$inferSelect;

// ---- Leads -----------------------------------------------------------------
export const leadsTable = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: text("phone"),
    company: text("company"),
    source: varchar("source", { length: 32 }).notNull().default("manual"), // website|manual|referral|marketplace|myjobquote|checkatrade
    sourceDetail: text("source_detail"),
    externalId: varchar("external_id", { length: 128 }), // ID from external platform (for dedup)
    status: varchar("status", { length: 16 }).notNull().default("new"), // new|contacted|qualified|won|lost
    title: text("title"),
    message: text("message"),
    valuePence: integer("value_pence").notNull().default(0),
    score: integer("score").notNull().default(0),
    ownerUserId: uuid("owner_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    convertedCustomerId: uuid("converted_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    convertedQuoteId: uuid("converted_quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
    firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
    followUpDoneAt: timestamp("follow_up_done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("leads_tenant_idx").on(t.tenantId),
    statusIdx: index("leads_status_idx").on(t.tenantId, t.status),
    sourceIdx: index("leads_source_idx").on(t.tenantId, t.source),
    followUpIdx: index("leads_follow_up_idx").on(t.tenantId, t.followUpDueAt),
    externalIdIdx: uniqueIndex("leads_external_id_uniq").on(t.tenantId, t.source, t.externalId).where(sql`external_id IS NOT NULL`),
  }),
);

export const leadNotesTable = pgTable(
  "lead_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    authorLabel: text("author_label"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_notes_lead_idx").on(t.leadId),
  }),
);

export const leadActivitiesTable = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 24 }).notNull(), // call|email|sms|meeting|note|status
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_activities_lead_idx").on(t.leadId, t.occurredAt),
  }),
);

export const leadFilesTable = pgTable(
  "lead_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 128 }),
    sizeBytes: integer("size_bytes"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    uploadedByLabel: text("uploaded_by_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_files_lead_idx").on(t.leadId, t.createdAt),
  }),
);

export type Lead = typeof leadsTable.$inferSelect;
export type LeadNote = typeof leadNotesTable.$inferSelect;
export type LeadActivity = typeof leadActivitiesTable.$inferSelect;
export type LeadFile = typeof leadFilesTable.$inferSelect;

// ---- Notifications: templates, prefs, threads, messages -------------------

export const notificationTemplatesTable = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
    eventKind: varchar("event_kind", { length: 64 }).notNull(),
    channel: varchar("channel", { length: 16 }).notNull(), // email|sms|whatsapp
    subject: text("subject"),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqGlobal: uniqueIndex("notif_tpl_global_uniq").on(t.eventKind, t.channel).where(sql`tenant_id IS NULL`),
    uniqTenant: uniqueIndex("notif_tpl_tenant_uniq").on(t.tenantId, t.eventKind, t.channel).where(sql`tenant_id IS NOT NULL`),
  }),
);

export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    eventKind: varchar("event_kind", { length: 64 }).notNull(),
    channel: varchar("channel", { length: 16 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    frequency: varchar("frequency", { length: 16 }).notNull().default("immediate"), // immediate|digest_daily|digest_weekly
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniq: uniqueIndex("notif_pref_uniq").on(t.tenantId, t.userId, t.eventKind, t.channel),
  }),
);

// Inbox threads — one per (customer, channel-or-portal). Aggregates customer_messages.
export const inboxThreadsTable = pgTable(
  "inbox_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobsTable.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 16 }).notNull().default("portal"), // portal|email|sms|whatsapp
    subject: text("subject"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    lastDirection: varchar("last_direction", { length: 8 }), // in|out
    unreadCount: integer("unread_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("inbox_threads_tenant_idx").on(t.tenantId, t.lastMessageAt),
    custIdx: index("inbox_threads_cust_idx").on(t.tenantId, t.customerId),
    jobIdx: index("inbox_threads_job_idx").on(t.tenantId, t.jobId),
    // Uniqueness is enforced by a raw partial index in DDL (uses COALESCE
    // over the nullable customer_id/job_id pair); not modelled in Drizzle.
  }),
);

export const inboxMessagesTable = pgTable(
  "inbox_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull().references(() => inboxThreadsTable.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 16 }).notNull(), // email|sms|whatsapp|portal|note
    direction: varchar("direction", { length: 8 }).notNull(), // in|out
    fromAddr: text("from_addr"),
    toAddr: text("to_addr"),
    subject: text("subject"),
    body: text("body").notNull(),
    deliveryId: uuid("delivery_id").references(() => notificationDeliveriesTable.id, { onDelete: "set null" }),
    externalRef: text("external_ref"), // provider message id (twilio sid, resend id, etc)
    authorUserId: uuid("author_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    authorLabel: text("author_label"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("inbox_msgs_thread_idx").on(t.threadId, t.createdAt),
    tenantIdx: index("inbox_msgs_tenant_idx").on(t.tenantId, t.createdAt),
  }),
);

export type NotificationTemplate = typeof notificationTemplatesTable.$inferSelect;
export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
export type InboxThread = typeof inboxThreadsTable.$inferSelect;
export type InboxMessage = typeof inboxMessagesTable.$inferSelect;

// ============================================================================
// Platform referrals — CtrlTrade grows via affiliate partners
// ============================================================================

export const platformReferralPartnersTable = pgTable(
  "platform_referral_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: text("name").notNull(),
    company: text("company"),
    passwordHash: text("password_hash").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending|approved|disabled
    commissionType: varchar("commission_type", { length: 16 }).notNull().default("recurring"), // recurring|fixed
    commissionPct: integer("commission_pct").notNull().default(20), // % of MRR for recurring
    commissionFixedPence: integer("commission_fixed_pence").notNull().default(0), // for fixed
    payoutMethod: varchar("payout_method", { length: 24 }),
    payoutDetails: jsonb("payout_details"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("platform_partners_status_idx").on(t.status),
  }),
);

export const platformReferralLinksTable = pgTable(
  "platform_referral_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull().unique(),
    label: text("label"),
    landingPath: text("landing_path").notNull().default("/"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("platform_links_partner_idx").on(t.partnerId),
  }),
);

export const platformReferralClicksTable = pgTable(
  "platform_referral_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id").notNull().references(() => platformReferralLinksTable.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    landingPath: text("landing_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    linkIdx: index("platform_clicks_link_idx").on(t.linkId, t.createdAt),
  }),
);

export const platformReferralLeadsTable = pgTable(
  "platform_referral_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id").references(() => platformReferralLinksTable.id, { onDelete: "set null" }),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    company: text("company"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("platform_leads_partner_idx").on(t.partnerId, t.createdAt),
  }),
);

export const platformReferralConversionsTable = pgTable(
  "platform_referral_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    linkId: uuid("link_id").references(() => platformReferralLinksTable.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }).unique(),
    firstPaidAt: timestamp("first_paid_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("signed_up"), // signed_up|paying|churned
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("platform_conv_partner_idx").on(t.partnerId),
  }),
);

export const platformReferralCommissionsTable = pgTable(
  "platform_referral_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    conversionId: uuid("conversion_id").notNull().references(() => platformReferralConversionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    invoiceTotalPence: integer("invoice_total_pence").notNull().default(0),
    commissionPence: integer("commission_pence").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    status: varchar("status", { length: 16 }).notNull().default("accrued"), // accrued|approved|paid|void
    stripeInvoiceId: text("stripe_invoice_id"),
    payoutId: uuid("payout_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("platform_comm_partner_idx").on(t.partnerId, t.status),
    invoiceIdx: uniqueIndex("platform_comm_invoice_uniq")
      .on(t.stripeInvoiceId)
      .where(sql`stripe_invoice_id IS NOT NULL`),
  }),
);

export const platformReferralPayoutsTable = pgTable(
  "platform_referral_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => platformReferralPartnersTable.id, { onDelete: "cascade" }),
    amountPence: integer("amount_pence").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    status: varchar("status", { length: 16 }).notNull().default("requested"), // requested|approved|paid|rejected
    method: varchar("method", { length: 24 }),
    reference: text("reference"),
    notes: text("notes"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  },
  (t) => ({
    partnerIdx: index("platform_payouts_partner_idx").on(t.partnerId, t.status),
  }),
);

// ============================================================================
// Tenant referrals — tenants reward their customers for referring friends
// ============================================================================

export const tenantReferralCampaignsTable = pgTable(
  "tenant_referral_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rewardType: varchar("reward_type", { length: 16 }).notNull(), // percent|fixed|cash
    rewardValuePence: integer("reward_value_pence").notNull().default(0), // pence for fixed/cash, % for percent
    rewardForReferrer: boolean("reward_for_referrer").notNull().default(true),
    rewardForReferee: boolean("reward_for_referee").notNull().default(false),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("tenant_campaigns_tenant_idx").on(t.tenantId),
  }),
);

export const tenantReferralCodesTable = pgTable(
  "tenant_referral_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => tenantReferralCampaignsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    shareUrl: text("share_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("tenant_codes_tenant_idx").on(t.tenantId),
    uniqCode: unique("tenant_codes_tenant_code_uniq").on(t.tenantId, t.code),
  }),
);

export const tenantReferralConversionsTable = pgTable(
  "tenant_referral_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => tenantReferralCampaignsTable.id, { onDelete: "cascade" }),
    codeId: uuid("code_id").notNull().references(() => tenantReferralCodesTable.id, { onDelete: "cascade" }),
    referrerCustomerId: uuid("referrer_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    refereeCustomerId: uuid("referee_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    refereeName: text("referee_name"),
    refereeEmail: varchar("referee_email", { length: 255 }),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending|qualified|rewarded|void
    completedJobId: uuid("completed_job_id").references(() => jobsTable.id, { onDelete: "set null" }),
    rewardPence: integer("reward_pence").notNull().default(0),
    rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("tenant_conv_tenant_idx").on(t.tenantId, t.status),
    referrerIdx: index("tenant_conv_referrer_idx").on(t.referrerCustomerId),
  }),
);

export const tenantReferralRewardsTable = pgTable(
  "tenant_referral_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    conversionId: uuid("conversion_id").notNull().references(() => tenantReferralConversionsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(), // credit|cash|discount
    amountPence: integer("amount_pence").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    status: varchar("status", { length: 16 }).notNull().default("issued"), // issued|redeemed|void
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("tenant_rewards_tenant_idx").on(t.tenantId),
    customerIdx: index("tenant_rewards_customer_idx").on(t.customerId),
  }),
);

// ============================================================================
// Marketplace — contractor & supplier directory + applications + B2B reviews
// ============================================================================

export const marketplaceListingsTable = pgTable(
  "marketplace_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }).unique(),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    listingType: varchar("listing_type", { length: 16 }).notNull().default("contractor"), // contractor|supplier|both
    headline: text("headline").notNull(),
    bio: text("bio"),
    categorySlugs: text("category_slugs").array().notNull().default(sql`'{}'::text[]`),
    serviceArea: text("service_area"),
    regions: text("regions").array().notNull().default(sql`'{}'::text[]`),
    hourlyRatePence: integer("hourly_rate_pence"),
    minJobValuePence: integer("min_job_value_pence"),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: text("contact_phone"),
    websiteUrl: text("website_url"),
    galleryUrls: text("gallery_urls").array().notNull().default(sql`'{}'::text[]`),
    verified: boolean("verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("draft"), // draft|published|paused
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("marketplace_listings_status_idx").on(t.status),
    typeIdx: index("marketplace_listings_type_idx").on(t.listingType),
  }),
);

export const marketplacePostsTable = pgTable(
  "marketplace_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(), // job|supplier_request
    title: text("title").notNull(),
    description: text("description").notNull(),
    categorySlugs: text("category_slugs").array().notNull().default(sql`'{}'::text[]`),
    region: text("region"),
    budgetPence: integer("budget_pence"),
    status: varchar("status", { length: 16 }).notNull().default("open"), // open|closed|fulfilled
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("marketplace_posts_status_idx").on(t.status),
    tenantIdx: index("marketplace_posts_tenant_idx").on(t.tenantId),
  }),
);

export const marketplaceApplicationsTable = pgTable(
  "marketplace_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").references(() => marketplacePostsTable.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => marketplaceListingsTable.id, { onDelete: "set null" }),
    applicantTenantId: uuid("applicant_tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    ownerTenantId: uuid("owner_tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    bidPence: integer("bid_pence"),
    status: varchar("status", { length: 16 }).notNull().default("submitted"), // submitted|accepted|declined|withdrawn
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index("marketplace_apps_post_idx").on(t.postId),
    applicantIdx: index("marketplace_apps_applicant_idx").on(t.applicantTenantId),
    ownerIdx: index("marketplace_apps_owner_idx").on(t.ownerTenantId),
  }),
);

export const marketplaceReviewsTable = pgTable(
  "marketplace_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").notNull().references(() => marketplaceListingsTable.id, { onDelete: "cascade" }),
    reviewerTenantId: uuid("reviewer_tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: index("marketplace_reviews_listing_idx").on(t.listingId),
    uniq: unique("marketplace_reviews_uniq").on(t.listingId, t.reviewerTenantId),
  }),
);

export type PlatformReferralPartner = typeof platformReferralPartnersTable.$inferSelect;
export type PlatformReferralLink = typeof platformReferralLinksTable.$inferSelect;
export type PlatformReferralConversion = typeof platformReferralConversionsTable.$inferSelect;
export type PlatformReferralCommission = typeof platformReferralCommissionsTable.$inferSelect;
export type PlatformReferralPayout = typeof platformReferralPayoutsTable.$inferSelect;
export type TenantReferralCampaign = typeof tenantReferralCampaignsTable.$inferSelect;
export type TenantReferralCode = typeof tenantReferralCodesTable.$inferSelect;
export type TenantReferralConversion = typeof tenantReferralConversionsTable.$inferSelect;
export type TenantReferralReward = typeof tenantReferralRewardsTable.$inferSelect;
export type MarketplaceListing = typeof marketplaceListingsTable.$inferSelect;
export type MarketplacePost = typeof marketplacePostsTable.$inferSelect;
export type MarketplaceApplication = typeof marketplaceApplicationsTable.$inferSelect;
export type MarketplaceReview = typeof marketplaceReviewsTable.$inferSelect;

export const stockLocationsTable = pgTable(
  "stock_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: varchar("kind", { length: 24 }).notNull().default("shop"), // shop|warehouse|van
    code: varchar("code", { length: 32 }),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    isDefault: boolean("is_default").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("stock_locations_tenant_idx").on(t.tenantId) }),
);

// Product categories (tenant-scoped, single-level for MVP)
export const productCategoriesTable = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("product_categories_tenant_idx").on(t.tenantId) }),
);

// Products (master)
export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategoriesTable.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 16 }).notNull().default("each"), // each|m|m2|kg|hr
    pricePence: integer("price_pence").notNull().default(0),
    costPence: integer("cost_pence").notNull().default(0),
    tradePricePence: integer("trade_price_pence"),
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
    barcode: varchar("barcode", { length: 64 }),
    trackStock: boolean("track_stock").notNull().default(true),
    reorderLevel: integer("reorder_level").notNull().default(0),
    reorderQty: integer("reorder_qty").notNull().default(0),
    supplierId: uuid("supplier_id"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("products_tenant_idx").on(t.tenantId),
    uniqSku: unique("products_tenant_sku_uniq").on(t.tenantId, t.sku),
    barcodeIdx: index("products_barcode_idx").on(t.tenantId, t.barcode),
  }),
);

// Product variants (size/colour/etc) — optional per product
export const productVariantsTable = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: text("name").notNull(),
    barcode: varchar("barcode", { length: 64 }),
    pricePence: integer("price_pence"),
    costPence: integer("cost_pence"),
    attributes: jsonb("attributes").$type<Record<string, string>>(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index("product_variants_product_idx").on(t.productId),
    barcodeIdx: index("product_variants_barcode_idx").on(t.tenantId, t.barcode),
    uniqSku: unique("product_variants_tenant_sku_uniq").on(t.tenantId, t.sku),
  }),
);

// Branch stock — qty on hand per (location, product/variant)
export const branchStockTable = pgTable(
  "branch_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(0),
    binCode: varchar("bin_code", { length: 32 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("branch_stock_tenant_idx").on(t.tenantId),
    uniqRow: uniqueIndex("branch_stock_uniq").on(t.locationId, t.productId, t.variantId),
  }),
);

// Stock movements (audit trail)
export const stockMovementsTable = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
    qtyDelta: integer("qty_delta").notNull(),
    reason: varchar("reason", { length: 32 }).notNull(), // sale|refund|adjustment|transfer_in|transfer_out|delivery|count
    refKind: varchar("ref_kind", { length: 32 }), // pos_transaction|adjustment|delivery|transfer
    refId: uuid("ref_id"),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("stock_movements_tenant_idx").on(t.tenantId),
    productIdx: index("stock_movements_product_idx").on(t.productId, t.createdAt),
  }),
);

// Warehouse bins
export const warehouseBinsTable = pgTable(
  "warehouse_bins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: unique("warehouse_bins_uniq").on(t.locationId, t.code) }),
);

// Suppliers
export const suppliersTable = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: varchar("email", { length: 255 }),
    phone: text("phone"),
    accountReference: text("account_reference"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("suppliers_tenant_idx").on(t.tenantId) }),
);

// Trade accounts (B2B customers with pricing tiers + credit limits)
export const tradeAccountsTable = pgTable(
  "trade_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    accountCode: varchar("account_code", { length: 32 }).notNull(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: text("phone"),
    pricingTier: varchar("pricing_tier", { length: 16 }).notNull().default("trade"), // trade|wholesale|custom
    discountPct: integer("discount_pct").notNull().default(0),
    creditLimitPence: integer("credit_limit_pence").notNull().default(0),
    balancePence: integer("balance_pence").notNull().default(0),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    pin: varchar("pin", { length: 8 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("trade_accounts_tenant_idx").on(t.tenantId),
    uniqCode: unique("trade_accounts_tenant_code_uniq").on(t.tenantId, t.accountCode),
  }),
);

// Cash drawers (physical till device registration)
export const cashDrawersTable = pgTable(
  "cash_drawers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => stockLocationsTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    deviceCode: varchar("device_code", { length: 32 }),
    refundApprovalPin: varchar("refund_approval_pin", { length: 8 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("cash_drawers_tenant_idx").on(t.tenantId) }),
);

// Till sessions (open / close cycle)
export const tillSessionsTable = pgTable(
  "till_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => stockLocationsTable.id, { onDelete: "set null" }),
    cashDrawerId: uuid("cash_drawer_id").references(() => cashDrawersTable.id, { onDelete: "set null" }),
    openedByUserId: uuid("opened_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    closedByUserId: uuid("closed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    openingFloatPence: integer("opening_float_pence").notNull().default(0),
    countedCashPence: integer("counted_cash_pence"),
    expectedCashPence: integer("expected_cash_pence"),
    cashSalesPence: integer("cash_sales_pence").notNull().default(0),
    cardSalesPence: integer("card_sales_pence").notNull().default(0),
    tradeSalesPence: integer("trade_sales_pence").notNull().default(0),
    refundsPence: integer("refunds_pence").notNull().default(0),
    variancePence: integer("variance_pence"),
    status: varchar("status", { length: 16 }).notNull().default("open"), // open|closed
    notes: text("notes"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index("till_sessions_tenant_idx").on(t.tenantId),
    statusIdx: index("till_sessions_status_idx").on(t.tenantId, t.status),
  }),
);

// POS transactions (richer than legacy pos_sales — supports basket of products + refunds)
export const posTransactionsTable = pgTable(
  "pos_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    tillSessionId: uuid("till_session_id").references(() => tillSessionsTable.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => stockLocationsTable.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    tradeAccountId: uuid("trade_account_id").references(() => tradeAccountsTable.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 16 }).notNull().default("sale"), // sale|refund
    refundOfId: uuid("refund_of_id"),
    number: varchar("number", { length: 32 }).notNull(),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    subtotalPence: integer("subtotal_pence").notNull().default(0),
    discountPence: integer("discount_pence").notNull().default(0),
    taxPence: integer("tax_pence").notNull().default(0),
    totalPence: integer("total_pence").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("gbp"),
    tender: varchar("tender", { length: 16 }).notNull(), // cash|card|split|trade_account
    cashTakenPence: integer("cash_taken_pence").notNull().default(0),
    cardTakenPence: integer("card_taken_pence").notNull().default(0),
    tradeCreditPence: integer("trade_credit_pence").notNull().default(0),
    changeGivenPence: integer("change_given_pence").notNull().default(0),
    refundApprovedByUserId: uuid("refund_approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    notes: text("notes"),
    receiptDeliveredAt: timestamp("receipt_delivered_at", { withTimezone: true }),
    receiptMethod: varchar("receipt_method", { length: 16 }),
    receiptDestination: text("receipt_destination"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("pos_transactions_tenant_idx").on(t.tenantId),
    sessionIdx: index("pos_transactions_session_idx").on(t.tillSessionId),
    uniqNumber: unique("pos_transactions_tenant_number_uniq").on(t.tenantId, t.number),
  }),
);

export const posTransactionItemsTable = pgTable(
  "pos_transaction_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull().references(() => posTransactionsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 64 }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPricePence: integer("unit_price_pence").notNull().default(0),
    discountPence: integer("discount_pence").notNull().default(0),
    taxPence: integer("tax_pence").notNull().default(0),
    totalPence: integer("total_pence").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({ txIdx: index("pos_transaction_items_tx_idx").on(t.transactionId) }),
);

// Supplier purchase orders + deliveries
export const supplierOrdersTable = pgTable(
  "supplier_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => stockLocationsTable.id, { onDelete: "set null" }),
    number: varchar("number", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("draft"), // draft|sent|partial|received|cancelled
    items: jsonb("items").notNull().$type<Array<{
      productId: string; sku?: string | null; description: string;
      quantity: number; unitCostPence: number;
    }>>(),
    subtotalPence: integer("subtotal_pence").notNull().default(0),
    notes: text("notes"),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("supplier_orders_tenant_idx").on(t.tenantId),
    uniqNum: unique("supplier_orders_tenant_number_uniq").on(t.tenantId, t.number),
  }),
);

export const supplierDeliveriesTable = pgTable(
  "supplier_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    supplierOrderId: uuid("supplier_order_id").references(() => supplierOrdersTable.id, { onDelete: "set null" }),
    locationId: uuid("location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "restrict" }),
    items: jsonb("items").notNull().$type<Array<{
      productId: string; variantId?: string | null; quantity: number;
    }>>(),
    notes: text("notes"),
    receivedByUserId: uuid("received_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("supplier_deliveries_tenant_idx").on(t.tenantId) }),
);

// Inventory adjustments (write-offs / stock counts)
export const inventoryAdjustmentsTable = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => stockLocationsTable.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
    qtyDelta: integer("qty_delta").notNull(),
    reason: varchar("reason", { length: 32 }).notNull().default("adjustment"), // adjustment|count|damage|theft|transfer
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("inventory_adjustments_tenant_idx").on(t.tenantId) }),
);

// Barcode label print jobs (kept for traceability)
export const barcodeLabelsTable = pgTable(
  "barcode_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => productsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
    barcode: varchar("barcode", { length: 64 }).notNull(),
    labelText: text("label_text"),
    pricePence: integer("price_pence"),
    quantity: integer("quantity").notNull().default(1),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index("barcode_labels_tenant_idx").on(t.tenantId) }),
);

export type StockLocation = typeof stockLocationsTable.$inferSelect;
export type ProductCategory = typeof productCategoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
export type BranchStock = typeof branchStockTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
export type WarehouseBin = typeof warehouseBinsTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type TradeAccount = typeof tradeAccountsTable.$inferSelect;
export type CashDrawer = typeof cashDrawersTable.$inferSelect;
export type TillSession = typeof tillSessionsTable.$inferSelect;
export type PosTransaction = typeof posTransactionsTable.$inferSelect;
export type PosTransactionItem = typeof posTransactionItemsTable.$inferSelect;
export type SupplierOrder = typeof supplierOrdersTable.$inferSelect;
export type SupplierDelivery = typeof supplierDeliveriesTable.$inferSelect;
export type InventoryAdjustment = typeof inventoryAdjustmentsTable.$inferSelect;
export type BarcodeLabel = typeof barcodeLabelsTable.$inferSelect;


// ---- Integrations (tenant connections + sync log + admin catalogue) -------
export const tenantIntegrationsTable = pgTable(
  "tenant_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("disconnected"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    externalAccountId: text("external_account_id"),
    externalAccountLabel: text("external_account_label"),
    scopes: text("scopes"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastError: text("last_error"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    connectedByUserId: uuid("connected_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniq: uniqueIndex("tenant_integrations_uniq").on(t.tenantId, t.provider),
    tenantIdx: index("tenant_integrations_tenant_idx").on(t.tenantId),
  }),
);

export const integrationSyncLogsTable = pgTable(
  "integration_sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    direction: varchar("direction", { length: 8 }).notNull(),
    entityKind: varchar("entity_kind", { length: 32 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 16 }).notNull(),
    message: text("message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProvIdx: index("integration_sync_logs_tenant_prov_idx").on(t.tenantId, t.provider, t.createdAt),
  }),
);

export const integrationCatalogueTable = pgTable("integration_catalogue", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 32 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  minPlan: varchar("min_plan", { length: 32 }),
  updatedByUserId: uuid("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TenantIntegration = typeof tenantIntegrationsTable.$inferSelect;
export type IntegrationSyncLog = typeof integrationSyncLogsTable.$inferSelect;
export type IntegrationCatalogue = typeof integrationCatalogueTable.$inferSelect;

// ---- CtrlWorkflow: Automation -----------------------------------------------

export const automationRulesTable = pgTable(
  "automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    triggerEvent: varchar("trigger_event", { length: 64 }).notNull(),
    conditions: jsonb("conditions").notNull().default(sql`'[]'::jsonb`),
    actions: jsonb("actions").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("automation_rules_tenant_idx").on(t.tenantId),
  }),
);

export const automationRunsTable = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").references(() => automationRulesTable.id, { onDelete: "set null" }),
    ruleName: text("rule_name"),
    triggerEvent: varchar("trigger_event", { length: 64 }).notNull(),
    triggerPayload: jsonb("trigger_payload"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    actionsRun: integer("actions_run").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index("automation_runs_tenant_idx").on(t.tenantId, t.startedAt),
  }),
);

export const approvalRequestsTable = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => automationRunsTable.id, { onDelete: "set null" }),
    ruleId: uuid("rule_id").references(() => automationRulesTable.id, { onDelete: "set null" }),
    entityKind: varchar("entity_kind", { length: 32 }),
    entityId: uuid("entity_id"),
    promptTitle: text("prompt_title").notNull(),
    promptBody: text("prompt_body"),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => usersTable.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("approval_requests_tenant_idx").on(t.tenantId, t.status),
  }),
);

// ---- CtrlVoice: Telephony ----------------------------------------------------

export const tenantPhoneNumbersTable = pgTable(
  "tenant_phone_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
    friendlyName: text("friendly_name"),
    twilioSid: varchar("twilio_sid", { length: 64 }),
    capabilities: jsonb("capabilities").default(sql`'{}'::jsonb`),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("tenant_phone_numbers_tenant_idx").on(t.tenantId),
    uniqueNumber: uniqueIndex("tenant_phone_numbers_number_idx").on(t.phoneNumber),
  }),
);

export const callRecordsTable = pgTable(
  "call_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    twilioCallSid: varchar("twilio_call_sid", { length: 64 }).unique(),
    direction: varchar("direction", { length: 8 }).notNull().default("inbound"),
    fromNumber: varchar("from_number", { length: 32 }),
    toNumber: varchar("to_number", { length: 32 }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    durationSeconds: integer("duration_seconds"),
    recordingUrl: text("recording_url"),
    recordingSid: varchar("recording_sid", { length: 64 }),
    transcription: text("transcription"),
    aiSummary: text("ai_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("call_records_tenant_idx").on(t.tenantId, t.createdAt),
  }),
);

export const voicemailsTable = pgTable(
  "voicemails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    callRecordId: uuid("call_record_id").references(() => callRecordsTable.id, { onDelete: "cascade" }),
    fromNumber: varchar("from_number", { length: 32 }),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    recordingUrl: text("recording_url"),
    recordingSid: varchar("recording_sid", { length: 64 }),
    durationSeconds: integer("duration_seconds"),
    transcription: text("transcription"),
    listenedAt: timestamp("listened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("voicemails_tenant_idx").on(t.tenantId, t.createdAt),
  }),
);

export type AutomationRule = typeof automationRulesTable.$inferSelect;
export type AutomationRun = typeof automationRunsTable.$inferSelect;
export type ApprovalRequest = typeof approvalRequestsTable.$inferSelect;
export type TenantPhoneNumber = typeof tenantPhoneNumbersTable.$inferSelect;
export type CallRecord = typeof callRecordsTable.$inferSelect;
export type Voicemail = typeof voicemailsTable.$inferSelect;

// ---- Timesheet entries (approval lifecycle) --------------------------------
export const timesheetEntriesTable = pgTable(
  "timesheet_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
    checkinId: uuid("checkin_id"),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    hoursWorked: text("hours_worked").notNull().default("0"),
    travelMinutes: integer("travel_minutes").notNull().default(0),
    mileageMiles: integer("mileage_miles").notNull().default(0),
    notes: text("notes"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    approvedBy: uuid("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("ts_entries_tenant_idx").on(t.tenantId),
    userIdx: index("ts_entries_user_idx").on(t.userId, t.date),
    jobIdx: index("ts_entries_job_idx").on(t.jobId),
    statusIdx: index("ts_entries_status_idx").on(t.tenantId, t.status),
  }),
);
export type TimesheetEntry = typeof timesheetEntriesTable.$inferSelect;

// ---- Branches --------------------------------------------------------------
export const branchesTable = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line_1"),
    city: text("city"),
    postcode: text("postcode"),
    phone: text("phone"),
    region: text("region"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("branches_tenant_idx").on(t.tenantId),
  }),
);

export type Branch = typeof branchesTable.$inferSelect;

// ---- Area Managers ---------------------------------------------------------
export const areaManagersTable = pgTable(
  "area_managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    branchIds: uuid("branch_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("area_managers_tenant_idx").on(t.tenantId),
    uniq: unique("area_managers_tenant_user_uniq").on(t.tenantId, t.userId),
  }),
);

export type AreaManager = typeof areaManagersTable.$inferSelect;

// ---- Job Cost Entries -------------------------------------------------------
export const jobCostEntriesTable = pgTable(
  "job_cost_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(), // labour|material|other
    description: text("description").notNull(),
    quantity: text("quantity").notNull().default("1"), // stored as numeric string for decimal support
    unitCostPence: integer("unit_cost_pence").notNull().default(0),
    totalCostPence: integer("total_cost_pence").notNull().default(0),
    productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }), // labour: the staff member
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("job_cost_entries_tenant_idx").on(t.tenantId),
    jobIdx: index("job_cost_entries_job_idx").on(t.jobId),
    kindIdx: index("job_cost_entries_kind_idx").on(t.tenantId, t.kind),
  }),
);

export type JobCostEntry = typeof jobCostEntriesTable.$inferSelect;

// ---- Job Checkins (GPS tracking / timesheets) -------------------------------------------
export const jobCheckinsTable = pgTable(
  "job_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    checkInLat: text("check_in_lat"),
    checkInLng: text("check_in_lng"),
    checkOutLat: text("check_out_lat"),
    checkOutLng: text("check_out_lng"),
    notes: text("notes"),
    durationMinutes: integer("duration_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("job_checkins_tenant_idx").on(t.tenantId),
    jobIdx: index("job_checkins_job_idx").on(t.jobId),
    userIdx: index("job_checkins_user_idx").on(t.userId, t.checkedInAt),
  }),
);
export type JobCheckin = typeof jobCheckinsTable.$inferSelect;

// ---- Staff availability blocks ------------------------------------------------
export const staffAvailabilityTable = pgTable(
  "staff_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(), // YYYY-MM-DD
    endDate: text("end_date").notNull(), // YYYY-MM-DD
    reason: varchar("reason", { length: 32 }).notNull().default("holiday"), // holiday|sick|training|other
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("staff_avail_tenant_idx").on(t.tenantId),
    userIdx: index("staff_avail_user_idx").on(t.tenantId, t.userId),
  }),
);
export type StaffAvailability = typeof staffAvailabilityTable.$inferSelect;

// ---- Platform Sales Leads (super-admin sales pipeline) --------------------
export const platformSalesLeadsTable = pgTable(
  "platform_sales_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: text("phone"),
    company: text("company"),
    trade: text("trade"),
    source: varchar("source", { length: 64 }).notNull().default("contact_form"),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    emailIdx: index("platform_sales_leads_email_idx").on(t.email),
    statusIdx: index("platform_sales_leads_status_idx").on(t.status, t.createdAt),
  }),
);
export type PlatformSalesLead = typeof platformSalesLeadsTable.$inferSelect;

export const platformSalesLeadMessagesTable = pgTable(
  "platform_sales_lead_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => platformSalesLeadsTable.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 16 }).notNull().default("note"),
    direction: varchar("direction", { length: 8 }).notNull().default("out"),
    body: text("body").notNull(),
    authorName: text("author_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("platform_sales_lead_msgs_lead_idx").on(t.leadId, t.createdAt),
  }),
);
export type PlatformSalesLeadMessage = typeof platformSalesLeadMessagesTable.$inferSelect;
