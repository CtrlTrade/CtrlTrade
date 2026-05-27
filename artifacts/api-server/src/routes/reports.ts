import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, lte, sql, isNotNull } from "drizzle-orm";
import {
  db,
  invoicesTable,
  paymentsTable,
  leadsTable,
  jobsTable,
  quotesTable,
  customersTable,
  usersTable,
  timesheetEntriesTable,
  jobCostEntriesTable,
} from "@workspace/db";
import {
  GetReportRevenueResponse,
  GetReportLeadRoiResponse,
  GetReportEngineerPerformanceResponse,
  GetReportQuoteConversionResponse,
  GetReportJobProfitabilityResponse,
  GetReportCustomerLtvResponse,
  GetReportAgedDebtorsResponse,
  GetReportActivityHeatmapResponse,
  GetReportInsightsResponse,
} from "@workspace/api-zod";
import { requireTenant, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

type Scope = { tenantId: string | null }; // null = platform-wide

function parsePeriod(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fromRaw = req.query.from as string | undefined;
  const toRaw = req.query.to as string | undefined;
  const from = fromRaw ? new Date(fromRaw) : defaultFrom;
  const to = toRaw ? new Date(toRaw) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: defaultFrom, to: now };
  }
  return { from, to };
}

function tenantFilter<T>(scope: Scope, col: any) {
  return scope.tenantId ? eq(col, scope.tenantId) : sql`true`;
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
}

// ---- Revenue ---------------------------------------------------------------
async function buildRevenue(scope: Scope, from: Date, to: Date) {
  const invWhere = and(
    tenantFilter(scope, invoicesTable.tenantId),
    gte(invoicesTable.createdAt, from),
    lte(invoicesTable.createdAt, to),
  );
  const dayBucket = sql<string>`to_char(date_trunc('day', ${invoicesTable.createdAt}), 'YYYY-MM-DD')`;
  const monthBucket = sql<string>`to_char(date_trunc('month', ${invoicesTable.createdAt}), 'YYYY-MM')`;

  const dayRows = await db
    .select({
      bucket: dayBucket,
      invoiced: sql<number>`coalesce(sum(${invoicesTable.totalPence}),0)::int`,
      collected: sql<number>`coalesce(sum(case when ${invoicesTable.status} = 'paid' then ${invoicesTable.totalPence} else 0 end),0)::int`,
    })
    .from(invoicesTable)
    .where(invWhere)
    .groupBy(dayBucket)
    .orderBy(dayBucket);

  const monthRows = await db
    .select({
      bucket: monthBucket,
      invoiced: sql<number>`coalesce(sum(${invoicesTable.totalPence}),0)::int`,
      collected: sql<number>`coalesce(sum(case when ${invoicesTable.status} = 'paid' then ${invoicesTable.totalPence} else 0 end),0)::int`,
    })
    .from(invoicesTable)
    .where(invWhere)
    .groupBy(monthBucket)
    .orderBy(monthBucket);

  const totals = await db
    .select({
      invoiced: sql<number>`coalesce(sum(${invoicesTable.totalPence}),0)::int`,
      collected: sql<number>`coalesce(sum(case when ${invoicesTable.status} = 'paid' then ${invoicesTable.totalPence} else 0 end),0)::int`,
      outstanding: sql<number>`coalesce(sum(case when ${invoicesTable.status} in ('sent','draft') then ${invoicesTable.totalPence} else 0 end),0)::int`,
    })
    .from(invoicesTable)
    .where(invWhere);

  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    totalInvoicedPence: totals[0]?.invoiced ?? 0,
    totalCollectedPence: totals[0]?.collected ?? 0,
    outstandingPence: totals[0]?.outstanding ?? 0,
    timeline: dayRows.map((r) => ({
      bucket: r.bucket,
      invoicedPence: r.invoiced,
      collectedPence: r.collected,
    })),
    byMonth: monthRows.map((r) => ({
      bucket: r.bucket,
      invoicedPence: r.invoiced,
      collectedPence: r.collected,
    })),
  };
}

// ---- Lead ROI --------------------------------------------------------------
async function buildLeadRoi(scope: Scope, from: Date, to: Date) {
  const where = and(
    tenantFilter(scope, leadsTable.tenantId),
    gte(leadsTable.createdAt, from),
    lte(leadsTable.createdAt, to),
  );
  const rows = await db
    .select({
      source: leadsTable.source,
      total: sql<number>`count(*)::int`,
      won: sql<number>`sum(case when ${leadsTable.status} = 'won' then 1 else 0 end)::int`,
      wonValue: sql<number>`coalesce(sum(case when ${leadsTable.status} = 'won' then ${leadsTable.valuePence} else 0 end),0)::int`,
      pipelineValue: sql<number>`coalesce(sum(case when ${leadsTable.status} in ('new','contacted','qualified') then ${leadsTable.valuePence} else 0 end),0)::int`,
    })
    .from(leadsTable)
    .where(where)
    .groupBy(leadsTable.source);

  let totalLeads = 0,
    wonLeads = 0,
    wonValuePence = 0,
    pipelineValuePence = 0;
  const out = rows.map((r) => {
    totalLeads += r.total;
    wonLeads += r.won;
    wonValuePence += r.wonValue;
    pipelineValuePence += r.pipelineValue;
    return {
      source: r.source,
      totalLeads: r.total,
      wonLeads: r.won,
      conversionPct: r.total > 0 ? Math.round((r.won / r.total) * 100) : 0,
      wonValuePence: r.wonValue,
      pipelineValuePence: r.pipelineValue,
    };
  });
  out.sort((a, b) => b.wonValuePence - a.wonValuePence);
  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    totalLeads,
    wonLeads,
    wonValuePence,
    pipelineValuePence,
    rows: out,
  };
}

// ---- Engineer performance --------------------------------------------------
async function buildEngineerPerformance(scope: Scope, from: Date, to: Date) {
  const jobWhere = and(
    tenantFilter(scope, jobsTable.tenantId),
    gte(jobsTable.createdAt, from),
    lte(jobsTable.createdAt, to),
  );
  const jobRows = await db
    .select({
      userId: jobsTable.assignedUserId,
      userName: usersTable.name,
      jobsTotal: sql<number>`count(*)::int`,
      jobsCompleted: sql<number>`sum(case when ${jobsTable.status} = 'completed' then 1 else 0 end)::int`,
      value: sql<number>`coalesce(sum(${jobsTable.valuePence}),0)::int`,
      onTime: sql<number>`sum(case when ${jobsTable.status} = 'completed' and ${jobsTable.scheduledEnd} >= ${jobsTable.updatedAt} then 1 else 0 end)::int`,
    })
    .from(jobsTable)
    .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
    .where(jobWhere)
    .groupBy(jobsTable.assignedUserId, usersTable.name);

  // Pull approved timesheet hours for the period
  const fromDateStr = from.toISOString().slice(0, 10);
  const toDateStr = to.toISOString().slice(0, 10);
  const tsWhere = and(
    tenantFilter(scope, timesheetEntriesTable.tenantId),
    eq(timesheetEntriesTable.status, "approved"),
    gte(timesheetEntriesTable.date, fromDateStr),
    lte(timesheetEntriesTable.date, toDateStr),
  );
  const tsRows = await db
    .select({
      userId: timesheetEntriesTable.userId,
      approvedHours: sql<number>`coalesce(sum(${timesheetEntriesTable.hoursWorked}::float),0)::float`,
      mileage: sql<number>`coalesce(sum(${timesheetEntriesTable.mileageMiles}),0)::int`,
    })
    .from(timesheetEntriesTable)
    .where(tsWhere)
    .groupBy(timesheetEntriesTable.userId);

  const tsMap = new Map(tsRows.map((r) => [r.userId, { hours: r.approvedHours, mileage: r.mileage }]));

  const out = jobRows.map((r) => {
    const ts = tsMap.get(r.userId ?? "") ?? { hours: 0, mileage: 0 };
    return {
      userId: r.userId,
      name: r.userName || "Unassigned",
      jobsCompleted: r.jobsCompleted,
      jobsTotal: r.jobsTotal,
      hours: Math.round(ts.hours * 10) / 10,
      approvedMileage: ts.mileage,
      totalValuePence: r.value,
      onTimePct: r.jobsCompleted > 0 ? Math.round((r.onTime / r.jobsCompleted) * 100) : 0,
    };
  });
  out.sort((a, b) => b.totalValuePence - a.totalValuePence);
  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    rows: out,
  };
}

// ---- Quote conversion ------------------------------------------------------
async function buildQuoteConversion(scope: Scope, from: Date, to: Date) {
  const where = and(
    tenantFilter(scope, quotesTable.tenantId),
    gte(quotesTable.createdAt, from),
    lte(quotesTable.createdAt, to),
  );
  const totals = await db
    .select({
      status: quotesTable.status,
      cnt: sql<number>`count(*)::int`,
    })
    .from(quotesTable)
    .where(where)
    .groupBy(quotesTable.status);

  let draft = 0,
    sent = 0,
    accepted = 0,
    declined = 0,
    converted = 0;
  for (const r of totals) {
    if (r.status === "draft") draft += r.cnt;
    if (r.status === "sent") sent += r.cnt;
    if (r.status === "accepted") accepted += r.cnt;
    if (r.status === "declined") declined += r.cnt;
    if (r.status === "converted") converted += r.cnt;
  }
  const totalActioned = sent + accepted + declined + converted;
  const accReached = accepted + converted;

  // Values (sum line items)
  const valueRows = await db
    .select({
      status: quotesTable.status,
      total: sql<number>`coalesce(sum(${quotesTable.depositPct}),0)::int`,
    })
    .from(quotesTable)
    .where(where)
    .groupBy(quotesTable.status);
  // depositPct is misleading — use a simple value proxy by joining line items
  const lineSums = await db.execute(sql`
    SELECT q.status, COALESCE(SUM(qli.quantity * qli.unit_price_pence),0)::int AS total
    FROM ${quotesTable} q
    LEFT JOIN quote_line_items qli ON qli.quote_id = q.id
    WHERE ${where}
    GROUP BY q.status
  `);
  let sentValue = 0,
    accValue = 0,
    convValue = 0;
  for (const r of (lineSums as any).rows ?? []) {
    const t = Number(r.total) || 0;
    if (r.status === "sent") sentValue += t;
    if (r.status === "accepted") accValue += t;
    if (r.status === "converted") convValue += t;
  }
  void valueRows;

  const dayBucket = sql<string>`to_char(date_trunc('day', ${quotesTable.createdAt}), 'YYYY-MM-DD')`;
  const timeline = await db
    .select({
      bucket: dayBucket,
      sent: sql<number>`sum(case when ${quotesTable.status} in ('sent','accepted','declined','converted') then 1 else 0 end)::int`,
      accepted: sql<number>`sum(case when ${quotesTable.status} in ('accepted','converted') then 1 else 0 end)::int`,
      converted: sql<number>`sum(case when ${quotesTable.status} = 'converted' then 1 else 0 end)::int`,
    })
    .from(quotesTable)
    .where(where)
    .groupBy(dayBucket)
    .orderBy(dayBucket);

  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    draft,
    sent,
    accepted,
    declined,
    converted,
    sentValuePence: sentValue + accValue + convValue,
    acceptedValuePence: accValue + convValue,
    convertedValuePence: convValue,
    acceptRatePct: totalActioned > 0 ? Math.round((accReached / totalActioned) * 100) : 0,
    conversionRatePct: totalActioned > 0 ? Math.round((converted / totalActioned) * 100) : 0,
    timeline: timeline.map((r) => ({
      bucket: r.bucket,
      sent: r.sent,
      accepted: r.accepted,
      converted: r.converted,
    })),
  };
}

// ---- Job profitability -----------------------------------------------------
async function buildJobProfitability(scope: Scope, from: Date, to: Date) {
  const where = and(
    tenantFilter(scope, jobsTable.tenantId),
    gte(jobsTable.createdAt, from),
    lte(jobsTable.createdAt, to),
  );
  const rows = await db
    .select({
      jobId: jobsTable.id,
      number: jobsTable.number,
      title: jobsTable.title,
      revenue: jobsTable.valuePence,
      customerName: customersTable.name,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(customersTable.id, jobsTable.customerId))
    .where(where)
    .orderBy(sql`${jobsTable.valuePence} DESC`)
    .limit(200);

  // Fetch actual costs per job from job_cost_entries
  const jobIds = rows.map((r) => r.jobId);
  const costMap = new Map<string, number>();
  if (jobIds.length > 0) {
    const costRows = await db
      .select({
        jobId: jobCostEntriesTable.jobId,
        total: sql<number>`coalesce(sum(${jobCostEntriesTable.totalCostPence}), 0)::int`,
      })
      .from(jobCostEntriesTable)
      .where(sql`${jobCostEntriesTable.jobId} = ANY(${jobIds})`)
      .groupBy(jobCostEntriesTable.jobId);
    for (const c of costRows) {
      costMap.set(c.jobId, c.total);
    }
  }

  const out = rows.map((r) => {
    const revenue = r.revenue ?? 0;
    const hasActualCosts = costMap.has(r.jobId) && (costMap.get(r.jobId) ?? 0) > 0;
    // Use actual costs if available; otherwise fall back to 40% estimated cost
    const cost = hasActualCosts ? (costMap.get(r.jobId) ?? 0) : Math.round(revenue * 0.4);
    const margin = revenue - cost;
    return {
      jobId: r.jobId,
      number: r.number,
      title: r.title,
      customerName: r.customerName ?? null,
      revenuePence: revenue,
      costPence: cost,
      marginPence: margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 100) : 0,
      hasActualCosts,
    };
  });
  const totalRevenue = out.reduce((s, r) => s + r.revenuePence, 0);
  const totalCost = out.reduce((s, r) => s + r.costPence, 0);
  const totalMargin = totalRevenue - totalCost;
  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    totalRevenuePence: totalRevenue,
    totalCostPence: totalCost,
    totalMarginPence: totalMargin,
    marginPct: totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0,
    rows: out,
  };
}

// ---- Customer LTV ----------------------------------------------------------
async function buildCustomerLtv(scope: Scope, from: Date, to: Date) {
  const where = and(
    tenantFilter(scope, invoicesTable.tenantId),
    gte(invoicesTable.createdAt, from),
    lte(invoicesTable.createdAt, to),
  );
  const rows = await db
    .select({
      customerId: invoicesTable.customerId,
      name: customersTable.name,
      invoiceCount: sql<number>`count(*)::int`,
      totalInvoiced: sql<number>`coalesce(sum(${invoicesTable.totalPence}),0)::int`,
      totalCollected: sql<number>`coalesce(sum(case when ${invoicesTable.status} = 'paid' then ${invoicesTable.totalPence} else 0 end),0)::int`,
      firstAt: sql<string | null>`to_char(min(${invoicesTable.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      lastAt: sql<string | null>`to_char(max(${invoicesTable.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(where)
    .groupBy(invoicesTable.customerId, customersTable.name)
    .orderBy(sql`coalesce(sum(${invoicesTable.totalPence}),0) DESC`)
    .limit(100);

  return {
    currency: "GBP",
    period: { from: from.toISOString(), to: to.toISOString() },
    rows: rows.map((r) => ({
      customerId: r.customerId,
      name: r.name ?? "—",
      invoiceCount: r.invoiceCount,
      totalInvoicedPence: r.totalInvoiced,
      totalCollectedPence: r.totalCollected,
      firstInvoiceAt: r.firstAt,
      lastInvoiceAt: r.lastAt,
    })),
  };
}

// ---- Aged debtors ----------------------------------------------------------
async function buildAgedDebtors(scope: Scope) {
  const where = and(
    tenantFilter(scope, invoicesTable.tenantId),
    sql`${invoicesTable.status} in ('sent','draft')`,
  );
  const open = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      total: invoicesTable.totalPence,
      dueAt: invoicesTable.dueAt,
      customerName: customersTable.name,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(where)
    .limit(500);

  // Subtract recorded payments
  const ids = open.map((o) => o.id);
  const pays = ids.length
    ? await db
        .select({
          invoiceId: paymentsTable.invoiceId,
          paid: sql<number>`coalesce(sum(${paymentsTable.amountPence}),0)::int`,
        })
        .from(paymentsTable)
        .where(sql`${paymentsTable.invoiceId} = ANY(${ids})`)
        .groupBy(paymentsTable.invoiceId)
    : [];
  const paidMap = new Map(pays.map((p) => [p.invoiceId, p.paid]));

  const now = Date.now();
  const buckets = [
    { label: "0-30", min: 0, max: 30, count: 0, totalPence: 0 },
    { label: "31-60", min: 31, max: 60, count: 0, totalPence: 0 },
    { label: "61-90", min: 61, max: 90, count: 0, totalPence: 0 },
    { label: "90+", min: 91, max: Infinity, count: 0, totalPence: 0 },
  ];
  const rows: any[] = [];
  let totalOutstanding = 0;
  for (const o of open) {
    const outstanding = o.total - (paidMap.get(o.id) ?? 0);
    if (outstanding <= 0) continue;
    const days = o.dueAt
      ? Math.floor((now - new Date(o.dueAt).getTime()) / (24 * 3600 * 1000))
      : 0;
    const overdue = Math.max(0, days);
    for (const b of buckets) {
      if (overdue >= b.min && overdue <= b.max) {
        b.count++;
        b.totalPence += outstanding;
        break;
      }
    }
    totalOutstanding += outstanding;
    rows.push({
      invoiceId: o.id,
      number: o.number,
      customerName: o.customerName ?? "—",
      totalPence: o.total,
      outstandingPence: outstanding,
      daysOverdue: overdue,
      dueAt: o.dueAt ? new Date(o.dueAt).toISOString() : null,
    });
  }
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return {
    currency: "GBP",
    totalOutstandingPence: totalOutstanding,
    buckets: buckets.map(({ label, count, totalPence }) => ({ label, count, totalPence })),
    rows: rows.slice(0, 200),
  };
}

// ---- Activity heatmap ------------------------------------------------------
async function buildActivityHeatmap(scope: Scope, from: Date, to: Date) {
  const where = and(
    tenantFilter(scope, jobsTable.tenantId),
    isNotNull(jobsTable.scheduledStart),
    gte(jobsTable.scheduledStart, from),
    lte(jobsTable.scheduledStart, to),
  );
  const rows = await db
    .select({
      dow: sql<number>`extract(dow from ${jobsTable.scheduledStart})::int`,
      hour: sql<number>`extract(hour from ${jobsTable.scheduledStart})::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .where(where)
    .groupBy(sql`extract(dow from ${jobsTable.scheduledStart})`, sql`extract(hour from ${jobsTable.scheduledStart})`);
  const cells = rows.map((r) => ({ dayOfWeek: r.dow, hour: r.hour, jobCount: r.cnt }));
  const totalJobs = cells.reduce((s, c) => s + c.jobCount, 0);
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totalJobs,
    cells,
  };
}

// ---- Insights (rule-based: biggest movers vs previous period) -------------
async function buildInsights(scope: Scope, from: Date, to: Date) {
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - spanMs);

  async function periodTotals(pFrom: Date, pTo: Date) {
    const invWhere = and(
      tenantFilter(scope, invoicesTable.tenantId),
      gte(invoicesTable.createdAt, pFrom),
      lte(invoicesTable.createdAt, pTo),
    );
    const [inv] = await db
      .select({
        invoiced: sql<number>`coalesce(sum(${invoicesTable.totalPence}),0)::int`,
        collected: sql<number>`coalesce(sum(case when ${invoicesTable.status} = 'paid' then ${invoicesTable.totalPence} else 0 end),0)::int`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(invoicesTable)
      .where(invWhere);
    const leadWhere = and(
      tenantFilter(scope, leadsTable.tenantId),
      gte(leadsTable.createdAt, pFrom),
      lte(leadsTable.createdAt, pTo),
    );
    const [ld] = await db
      .select({
        leads: sql<number>`count(*)::int`,
        won: sql<number>`sum(case when ${leadsTable.status} = 'won' then 1 else 0 end)::int`,
      })
      .from(leadsTable)
      .where(leadWhere);
    const jobWhere = and(
      tenantFilter(scope, jobsTable.tenantId),
      gte(jobsTable.createdAt, pFrom),
      lte(jobsTable.createdAt, pTo),
    );
    const [jb] = await db
      .select({
        completed: sql<number>`sum(case when ${jobsTable.status} = 'completed' then 1 else 0 end)::int`,
      })
      .from(jobsTable)
      .where(jobWhere);
    return {
      invoiced: inv?.invoiced ?? 0,
      collected: inv?.collected ?? 0,
      invoices: inv?.cnt ?? 0,
      leads: ld?.leads ?? 0,
      wonLeads: ld?.won ?? 0,
      jobsCompleted: jb?.completed ?? 0,
    };
  }
  const curr = await periodTotals(from, to);
  const prev = await periodTotals(prevFrom, prevTo);

  function fmtGbp(p: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(p / 100);
  }
  function dir(c: number, p: number): "up" | "down" | "flat" {
    if (c === p) return "flat";
    return c > p ? "up" : "down";
  }

  const candidates = [
    {
      key: "invoiced",
      title: "Invoiced revenue",
      detail: `${fmtGbp(curr.invoiced)} this period vs ${fmtGbp(prev.invoiced)} previous.`,
      curr: curr.invoiced,
      prev: prev.invoiced,
    },
    {
      key: "collected",
      title: "Collected cash",
      detail: `${fmtGbp(curr.collected)} collected vs ${fmtGbp(prev.collected)} previous.`,
      curr: curr.collected,
      prev: prev.collected,
    },
    {
      key: "leads",
      title: "Inbound leads",
      detail: `${curr.leads} new leads vs ${prev.leads} previous.`,
      curr: curr.leads,
      prev: prev.leads,
    },
    {
      key: "won",
      title: "Leads won",
      detail: `${curr.wonLeads} won vs ${prev.wonLeads} previous.`,
      curr: curr.wonLeads,
      prev: prev.wonLeads,
    },
    {
      key: "jobs",
      title: "Jobs completed",
      detail: `${curr.jobsCompleted} completed vs ${prev.jobsCompleted} previous.`,
      curr: curr.jobsCompleted,
      prev: prev.jobsCompleted,
    },
  ];
  candidates.sort((a, b) => Math.abs(pctChange(b.curr, b.prev)) - Math.abs(pctChange(a.curr, a.prev)));
  const items = candidates.slice(0, 3).map((c) => ({
    title: c.title,
    detail: c.detail,
    direction: dir(c.curr, c.prev),
    changePct: pctChange(c.curr, c.prev),
  }));
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    items,
  };
}

// ---- Wire endpoints --------------------------------------------------------
function mount(
  basePath: string,
  guard: (req: Request, res: Response, next: any) => void,
  scopeFor: (req: Request) => Scope,
) {
  router.get(`${basePath}/revenue`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildRevenue(scopeFor(req), from, to);
    res.json(GetReportRevenueResponse.parse(data));
  });
  router.get(`${basePath}/lead-roi`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildLeadRoi(scopeFor(req), from, to);
    res.json(GetReportLeadRoiResponse.parse(data));
  });
  router.get(`${basePath}/engineer-performance`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildEngineerPerformance(scopeFor(req), from, to);
    res.json(GetReportEngineerPerformanceResponse.parse(data));
  });
  router.get(`${basePath}/quote-conversion`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildQuoteConversion(scopeFor(req), from, to);
    res.json(GetReportQuoteConversionResponse.parse(data));
  });
  router.get(`${basePath}/job-profitability`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildJobProfitability(scopeFor(req), from, to);
    res.json(GetReportJobProfitabilityResponse.parse(data));
  });
  router.get(`${basePath}/customer-ltv`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildCustomerLtv(scopeFor(req), from, to);
    res.json(GetReportCustomerLtvResponse.parse(data));
  });
  router.get(`${basePath}/aged-debtors`, guard, async (req, res): Promise<void> => {
    const data = await buildAgedDebtors(scopeFor(req));
    res.json(GetReportAgedDebtorsResponse.parse(data));
  });
  router.get(`${basePath}/activity-heatmap`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildActivityHeatmap(scopeFor(req), from, to);
    res.json(GetReportActivityHeatmapResponse.parse(data));
  });
  router.get(`${basePath}/insights`, guard, async (req, res): Promise<void> => {
    const { from, to } = parsePeriod(req);
    const data = await buildInsights(scopeFor(req), from, to);
    res.json(GetReportInsightsResponse.parse(data));
  });
}

mount("/v1/reports", requireTenant, (req) => ({ tenantId: req.auth!.tenant!.id }));
mount("/v1/admin/reports", requireSuperAdmin, () => ({ tenantId: null }));

export default router;
