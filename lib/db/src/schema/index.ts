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
    leadCaptureAllowedOrigins: text("lead_capture_allowed_origins").array().notNull().default(sql`'{}'::text[]`),
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
    invoiceNumberSeq: integer("invoice_number_seq").notNull().default(0),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("tenants_status_idx").on(t.status),
    stripeCustIdx: index("tenants_stripe_customer_idx").on(t.stripeCustomerId),
  }),
);

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
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  subject: text("subject"),
  payload: jsonb("payload"),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("notif_tenant_idx").on(t.tenantId) }));

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("customers_tenant_idx").on(t.tenantId),
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

// ---- Jobs + scheduling -----------------------------------------------------
export const jobsTable = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("jobs_tenant_idx").on(t.tenantId),
    statusIdx: index("jobs_status_idx").on(t.status),
    scheduleIdx: index("jobs_schedule_idx").on(t.tenantId, t.scheduledStart),
    assignedIdx: index("jobs_assigned_idx").on(t.assignedUserId),
    uniqNum: unique("jobs_tenant_number_uniq").on(t.tenantId, t.number),
  }),
);

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
    source: varchar("source", { length: 32 }).notNull().default("manual"), // website|manual|referral|marketplace
    sourceDetail: text("source_detail"),
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
