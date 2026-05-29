import { Router, type IRouter } from "express";
import { GetExpiryAttentionResponse } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { collectTenantExpiries, EXPIRY_WINDOW_DAYS } from "../lib/expiryDigest";
import { db } from "@workspace/db";
import { invoicesTable, quotesTable, quoteLineItemsTable, jobsTable } from "@workspace/db";
import { eq, and, lt, gte, isNull, or, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/dashboard/expiry-attention", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const items = await collectTenantExpiries(tenantId);
  const expiredCount = items.filter((i) => i.expired).length;
  res.json(
    GetExpiryAttentionResponse.parse({
      windowDays: EXPIRY_WINDOW_DAYS,
      expiredCount,
      expiringCount: items.length - expiredCount,
      items: items.slice(0, 25),
    }),
  );
});

router.get("/v1/dashboard/financial-summary", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Revenue this month (paid invoices)
  const [revenueThisMonth] = await db
    .select({ total: sql<number>`coalesce(sum(${invoicesTable.totalPence}), 0)::int` })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "paid"),
      gte(invoicesTable.paidAt, startOfMonth),
    ));

  // Revenue last month (paid invoices)
  const [revenueLastMonth] = await db
    .select({ total: sql<number>`coalesce(sum(${invoicesTable.totalPence}), 0)::int` })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "paid"),
      gte(invoicesTable.paidAt, startOfLastMonth),
      lt(invoicesTable.paidAt, startOfMonth),
    ));

  // Outstanding: sent but not overdue (due_at is null or in the future)
  const [outstanding] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoicesTable.totalPence}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "sent"),
      or(isNull(invoicesTable.dueAt), gte(invoicesTable.dueAt, now)),
    ));

  // Overdue: sent and past due_at
  const [overdue] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoicesTable.totalPence}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "sent"),
      lt(invoicesTable.dueAt, now),
    ));

  // Draft invoices
  const [drafts] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoicesTable.totalPence}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "draft"),
    ));

  // Quote pipeline: sum of line items for sent/accepted quotes
  const [pipeline] = await db
    .select({
      total: sql<number>`coalesce(sum(${quoteLineItemsTable.quantity} * ${quoteLineItemsTable.unitPricePence}), 0)::int`,
      count: sql<number>`count(distinct ${quotesTable.id})::int`,
    })
    .from(quotesTable)
    .innerJoin(quoteLineItemsTable, eq(quoteLineItemsTable.quoteId, quotesTable.id))
    .where(and(
      eq(quotesTable.tenantId, tenantId),
      sql`${quotesTable.status} in ('sent', 'accepted')`,
    ));

  // Jobs this month (any status)
  const [jobsThisMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(
      eq(jobsTable.tenantId, tenantId),
      gte(jobsTable.createdAt, startOfMonth),
    ));

  // Jobs completed this month
  const [jobsCompleted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(
      eq(jobsTable.tenantId, tenantId),
      eq(jobsTable.status, "completed"),
      gte(jobsTable.completedAt, startOfMonth),
    ));

  // Average job value (completed jobs with value > 0, all time)
  const [avgJob] = await db
    .select({ avg: sql<number>`coalesce(avg(${jobsTable.valuePence}), 0)::int` })
    .from(jobsTable)
    .where(and(
      eq(jobsTable.tenantId, tenantId),
      eq(jobsTable.status, "completed"),
      sql`${jobsTable.valuePence} > 0`,
    ));

  // Determine currency from most recent invoice or default to gbp
  const [currencyRow] = await db
    .select({ currency: invoicesTable.currency })
    .from(invoicesTable)
    .where(eq(invoicesTable.tenantId, tenantId))
    .limit(1);

  res.json({
    currency: currencyRow?.currency ?? "gbp",
    revenueThisMonthPence: revenueThisMonth?.total ?? 0,
    revenueLastMonthPence: revenueLastMonth?.total ?? 0,
    outstandingPence: outstanding?.total ?? 0,
    outstandingCount: outstanding?.count ?? 0,
    overduePence: overdue?.total ?? 0,
    overdueCount: overdue?.count ?? 0,
    draftPence: drafts?.total ?? 0,
    draftCount: drafts?.count ?? 0,
    pipelinePence: pipeline?.total ?? 0,
    pipelineCount: pipeline?.count ?? 0,
    jobsThisMonth: jobsThisMonth?.count ?? 0,
    jobsCompletedThisMonth: jobsCompleted?.count ?? 0,
    avgJobValuePence: avgJob?.avg ?? 0,
  });
});

export default router;
