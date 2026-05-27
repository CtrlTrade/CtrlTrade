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

// ---- Types ----------------------------------------------------------------
export type Tenant = typeof tenantsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Membership = typeof membershipsTable.$inferSelect;
export type TradeCategory = typeof tradeCategoriesTable.$inferSelect;
export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
