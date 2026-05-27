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
    vatRatePct: integer("vat_rate_pct").notNull().default(20),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique("memberships_tenant_user_uniq").on(t.tenantId, t.userId),
    tenantIdx: index("memberships_tenant_idx").on(t.tenantId),
    userIdx: index("memberships_user_idx").on(t.userId),
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
  value: jsonb("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("ff_tenant_idx").on(t.tenantId) }));

export const notificationDeliveriesTable = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 32 }).notNull(),
  template: varchar("template", { length: 64 }).notNull(),
  payload: jsonb("payload"),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("notif_tenant_idx").on(t.tenantId) }));

export const filesTable = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("files_tenant_idx").on(t.tenantId) }));

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
