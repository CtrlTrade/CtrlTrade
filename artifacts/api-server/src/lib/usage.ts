import { and, between, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  usageEventsTable,
  usageCountersTable,
  tenantUsageSummaryTable,
  tenantsTable,
} from "@workspace/db";
import { logger } from "./logger";

export type UsageKind =
  | "email"
  | "sms"
  | "whatsapp"
  | "ai_call"
  | "voice_minute"
  | "api_call"
  | "pdf_generated"
  | "file_uploaded";

/** Append-only event; never fail callers — usage is best-effort. */
export async function recordUsage(
  tenantId: string,
  kind: UsageKind,
  amount = 1,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(usageEventsTable).values({ tenantId, kind, amount, metadata: metadata ?? null });
  } catch (err) {
    logger.warn({ err, tenantId, kind }, "recordUsage failed (swallowed)");
  }
}

function hourBucket(d: Date): Date {
  const r = new Date(d);
  r.setUTCMinutes(0, 0, 0);
  return r;
}

function dayBucket(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

/** Roll all unrolled usage_events into hourly usage_counters. Idempotent. */
export async function rollupHourly(now: Date = new Date()): Promise<{ rolled: number }> {
  // Aggregate everything from events older than current hour or up to now.
  // Strategy: aggregate per (tenant, kind, hour) and UPSERT into counters with
  // count = SUM (since events are append-only, replaying yields the same SUM).
  const cutoff = hourBucket(now); // process up to end of previous hour
  const rows = await db
    .select({
      tenantId: usageEventsTable.tenantId,
      kind: usageEventsTable.kind,
      bucket: sql<Date>`date_trunc('hour', ${usageEventsTable.createdAt})`,
      total: sql<number>`coalesce(sum(${usageEventsTable.amount}),0)::int`,
    })
    .from(usageEventsTable)
    .where(lt(usageEventsTable.createdAt, cutoff))
    .groupBy(usageEventsTable.tenantId, usageEventsTable.kind, sql`date_trunc('hour', ${usageEventsTable.createdAt})`);

  let rolled = 0;
  for (const r of rows) {
    await db
      .insert(usageCountersTable)
      .values({ tenantId: r.tenantId, kind: r.kind, periodStart: new Date(r.bucket as any), count: r.total })
      .onConflictDoUpdate({
        target: [usageCountersTable.tenantId, usageCountersTable.kind, usageCountersTable.periodStart],
        set: { count: r.total, updatedAt: new Date() },
      });
    rolled++;
  }
  return { rolled };
}

/** Daily roll-up from hourly counters → tenant_usage_summary. */
export async function rollupDaily(now: Date = new Date()): Promise<{ rolled: number }> {
  const cutoff = dayBucket(now);
  const rows = await db
    .select({
      tenantId: usageCountersTable.tenantId,
      kind: usageCountersTable.kind,
      day: sql<Date>`date_trunc('day', ${usageCountersTable.periodStart})`,
      total: sql<number>`coalesce(sum(${usageCountersTable.count}),0)::int`,
    })
    .from(usageCountersTable)
    .where(lt(usageCountersTable.periodStart, cutoff))
    .groupBy(usageCountersTable.tenantId, usageCountersTable.kind, sql`date_trunc('day', ${usageCountersTable.periodStart})`);
  let rolled = 0;
  for (const r of rows) {
    await db
      .insert(tenantUsageSummaryTable)
      .values({ tenantId: r.tenantId, kind: r.kind, day: new Date(r.day as any), count: r.total })
      .onConflictDoUpdate({
        target: [tenantUsageSummaryTable.tenantId, tenantUsageSummaryTable.kind, tenantUsageSummaryTable.day],
        set: { count: r.total },
      });
    rolled++;
  }
  return { rolled };
}

/** Tenant usage for a window, falling back to live events if no counters yet. */
export async function tenantUsageForWindow(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<Array<{ kind: string; count: number }>> {
  // Combine counters (≤ start of current hour) + raw events (current hour).
  const currentHourStart = hourBucket(end);

  const counters = await db
    .select({
      kind: usageCountersTable.kind,
      total: sql<number>`coalesce(sum(${usageCountersTable.count}),0)::int`,
    })
    .from(usageCountersTable)
    .where(and(
      eq(usageCountersTable.tenantId, tenantId),
      gte(usageCountersTable.periodStart, start),
      lt(usageCountersTable.periodStart, currentHourStart),
    ))
    .groupBy(usageCountersTable.kind);

  const live = await db
    .select({
      kind: usageEventsTable.kind,
      total: sql<number>`coalesce(sum(${usageEventsTable.amount}),0)::int`,
    })
    .from(usageEventsTable)
    .where(and(
      eq(usageEventsTable.tenantId, tenantId),
      gte(usageEventsTable.createdAt, currentHourStart),
      lt(usageEventsTable.createdAt, end),
    ))
    .groupBy(usageEventsTable.kind);

  const map = new Map<string, number>();
  for (const c of counters) map.set(c.kind, (map.get(c.kind) ?? 0) + c.total);
  for (const c of live) map.set(c.kind, (map.get(c.kind) ?? 0) + c.total);
  return Array.from(map.entries()).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}

/** Per-tenant breakdown for super admin: this calendar month. */
export async function adminUsageBreakdown(now: Date = new Date()): Promise<{
  start: Date;
  end: Date;
  totals: Array<{ kind: string; count: number }>;
  byTenant: Array<{ tenantId: string; tenantName: string; total: number; rows: Array<{ kind: string; count: number }> }>;
}> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = now;

  // Single grouped query per source: counters (full hours) + live events (current hour).
  const currentHourStart = hourBucket(end);
  const tenants = await db.select({ id: tenantsTable.id, name: tenantsTable.name }).from(tenantsTable);
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));

  const counterRows = await db
    .select({
      tenantId: usageCountersTable.tenantId,
      kind: usageCountersTable.kind,
      total: sql<number>`coalesce(sum(${usageCountersTable.count}),0)::int`,
    })
    .from(usageCountersTable)
    .where(and(
      gte(usageCountersTable.periodStart, start),
      lt(usageCountersTable.periodStart, currentHourStart),
    ))
    .groupBy(usageCountersTable.tenantId, usageCountersTable.kind);

  const liveRows = await db
    .select({
      tenantId: usageEventsTable.tenantId,
      kind: usageEventsTable.kind,
      total: sql<number>`coalesce(sum(${usageEventsTable.amount}),0)::int`,
    })
    .from(usageEventsTable)
    .where(and(
      gte(usageEventsTable.createdAt, currentHourStart),
      lt(usageEventsTable.createdAt, end),
    ))
    .groupBy(usageEventsTable.tenantId, usageEventsTable.kind);

  const perTenant = new Map<string, Map<string, number>>();
  const add = (tid: string, kind: string, n: number) => {
    let m = perTenant.get(tid);
    if (!m) { m = new Map(); perTenant.set(tid, m); }
    m.set(kind, (m.get(kind) ?? 0) + n);
  };
  for (const r of counterRows) add(r.tenantId, r.kind, r.total);
  for (const r of liveRows) add(r.tenantId, r.kind, r.total);

  const byTenant: Array<{ tenantId: string; tenantName: string; total: number; rows: Array<{ kind: string; count: number }> }> = [];
  const totalsMap = new Map<string, number>();
  for (const [tid, m] of perTenant) {
    const rows = Array.from(m.entries()).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
    const total = rows.reduce((s, r) => s + r.count, 0);
    if (total === 0) continue;
    byTenant.push({ tenantId: tid, tenantName: nameById.get(tid) ?? tid, total, rows });
    for (const r of rows) totalsMap.set(r.kind, (totalsMap.get(r.kind) ?? 0) + r.count);
  }
  byTenant.sort((a, b) => b.total - a.total);
  const totals = Array.from(totalsMap.entries()).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
  return { start, end, totals, byTenant };
}

void between; void desc;
