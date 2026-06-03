import { useState, useEffect, useRef } from "react";
import {
  useGetOnboarding,
  useGetExpiryAttention,
  useGetLeadSourceRoi,
  useGetInboxUnreadCount,
  useListInboxThreads,
  useGetIndustryTour,
  useDismissIndustryTour,
  useGetFinancialSummary,
  useGetSession,
  useListJobs,
  useListStaffNotifications,
  useGetReportRevenue,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation } from "wouter";
import {
  CheckCircle2, Circle, AlertTriangle, Clock, Target, Inbox, X, Sparkles,
  ArrowRight, TrendingUp, TrendingDown, Minus, BadgePoundSterling, ReceiptText,
  TriangleAlert, Briefcase, Bell, FileText, Plus,
  Calendar, ChevronRight, Activity, CheckSquare,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ─── Helpers ─── */

function fmtGbp(pence: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* ─── Count-up animation ─── */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    setValue(0);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

/* ─── MoM badge ─── */
function MoMBadge({ thisMonth, lastMonth }: { thisMonth: number; lastMonth: number }) {
  if (lastMonth === 0 && thisMonth === 0) return null;
  if (lastMonth === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-sm">
        <TrendingUp className="h-3 w-3" /> New
      </span>
    );
  }
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
        <Minus className="h-3 w-3" /> 0% vs last mo
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${up ? "text-green-600 bg-green-500/10" : "text-destructive bg-destructive/10"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}% vs last mo
    </span>
  );
}

/* ─── Tiny sparkline ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="opacity-70">
      <polyline points={pts.join(" ")} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Sync pulse ─── */
function SyncPulse({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-primary" : "bg-green-500"}`} />
    </span>
  );
}

/* ─── Greeting header ─── */
function GreetingHeader({ isFetching }: { isFetching: boolean }) {
  const { data: session } = useGetSession();
  const [, setLocation] = useLocation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading leading-tight">
          {timeGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{fmtDate(now)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SyncPulse active={isFetching} />
          <span>{isFetching ? "Syncing…" : "Live"}</span>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl text-xs font-bold"
          onClick={() => setLocation("/app/jobs")}
        >
          <Plus className="h-3.5 w-3.5" />
          New Job
        </Button>
      </div>
    </motion.div>
  );
}

/* ─── KPI card ─── */
type KpiAccent = "primary" | "destructive" | "success" | "neutral";

interface KpiTileDef {
  label: string;
  icon: typeof BadgePoundSterling;
  rawValue: number;
  isCurrency: boolean;
  currency?: string;
  badge?: React.ReactNode;
  sub: string;
  accent: KpiAccent;
  href: string;
  testId: string;
  sparkData?: number[];
}

function KpiCard({ tile, idx }: { tile: KpiTileDef; idx: number }) {
  const Icon = tile.icon;
  const animated = useCountUp(tile.rawValue);
  const displayValue = tile.isCurrency
    ? fmtGbp(animated, tile.currency ?? "gbp")
    : String(animated);

  const isDestructive = tile.accent === "destructive";
  const isPrimary = tile.accent === "primary";
  const isSuccess = tile.accent === "success";

  const sparkColor = isDestructive
    ? "hsl(4 86% 58%)"
    : isPrimary
    ? "hsl(46 98% 42%)"
    : isSuccess
    ? "hsl(152 60% 40%)"
    : "hsl(220 74% 50%)";

  const cardCls = isDestructive
    ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10 hover:shadow-[0_4px_20px_-4px_hsl(4_86%_58%/0.25)]"
    : isPrimary
    ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:shadow-[0_4px_20px_-4px_hsl(46_98%_52%/0.3)]"
    : isSuccess
    ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10"
    : "border-border bg-card hover:bg-muted/40 hover:shadow-md";

  const labelCls = isDestructive
    ? "text-destructive/70"
    : isPrimary
    ? "text-primary/80"
    : isSuccess
    ? "text-green-600/80"
    : "text-muted-foreground";

  const valueCls = isDestructive
    ? "text-destructive"
    : isPrimary
    ? "text-primary"
    : isSuccess
    ? "text-green-600"
    : "";

  const iconCls = isDestructive
    ? "text-destructive"
    : isPrimary
    ? "text-primary"
    : isSuccess
    ? "text-green-600"
    : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: idx * 0.06 }}
      className="min-w-[160px] sm:min-w-0"
    >
      <Link href={tile.href}>
        <div
          data-testid={tile.testId}
          className={`group relative flex flex-col gap-2 p-4 rounded-2xl border cursor-pointer transition-all duration-200 h-full hover:-translate-y-0.5 ${cardCls}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-semibold tracking-wide uppercase ${labelCls}`}>
              {tile.label}
            </span>
            <Icon className={`h-4 w-4 shrink-0 opacity-50 ${iconCls}`} />
          </div>

          <div className={`text-2xl font-bold leading-none tracking-tight font-heading tabular-nums ${valueCls}`}>
            {displayValue}
          </div>

          {tile.sparkData && (
            <div className="mt-0.5">
              <Sparkline data={tile.sparkData} color={sparkColor} />
            </div>
          )}

          <div className="space-y-1 mt-auto">
            {tile.badge}
            <p className="text-[11px] text-muted-foreground leading-snug">{tile.sub}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── KPI strip — 7 tiles ─── */
function KpiStrip() {
  const { data, isLoading } = useGetFinancialSummary();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-7 sm:overflow-visible sm:pb-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="min-w-[160px] sm:min-w-0">
            <Skeleton className="h-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const currency = data.currency ?? "gbp";

  const tiles: KpiTileDef[] = [
    {
      label: "Revenue Today",
      icon: BadgePoundSterling,
      rawValue: data.revenueTodayPence,
      isCurrency: true,
      currency,
      badge: undefined,
      sub: "paid invoices today",
      accent: "primary",
      href: "/app/invoices",
      testId: "kpi-revenue-today",
      sparkData: [
        data.revenueLastMonthPence * 0.03,
        data.revenueLastMonthPence * 0.035,
        data.revenueLastMonthPence * 0.028,
        data.revenueLastMonthPence * 0.04,
        data.revenueTodayPence * 0.5,
        data.revenueTodayPence * 0.8,
        data.revenueTodayPence,
      ],
    },
    {
      label: "Revenue Month",
      icon: TrendingUp,
      rawValue: data.revenueThisMonthPence,
      isCurrency: true,
      currency,
      badge: <MoMBadge thisMonth={data.revenueThisMonthPence} lastMonth={data.revenueLastMonthPence} />,
      sub: data.revenueLastMonthPence > 0 ? `${fmtGbp(data.revenueLastMonthPence, currency)} last mo` : "No revenue last month",
      accent: "neutral",
      href: "/app/invoices",
      testId: "kpi-revenue",
    },
    {
      label: "Outstanding",
      icon: ReceiptText,
      rawValue: data.outstandingPence,
      isCurrency: true,
      currency,
      badge: undefined,
      sub: `${data.outstandingCount} invoice${data.outstandingCount === 1 ? "" : "s"} awaiting`,
      accent: "neutral",
      href: "/app/invoices",
      testId: "kpi-outstanding",
    },
    {
      label: "Overdue",
      icon: TriangleAlert,
      rawValue: data.overduePence,
      isCurrency: true,
      currency,
      badge: undefined,
      sub: `${data.overdueCount} invoice${data.overdueCount === 1 ? "" : "s"} past due`,
      accent: data.overdueCount > 0 ? "destructive" : "neutral",
      href: "/app/invoices",
      testId: "kpi-overdue",
    },
    {
      label: "Quote Pipeline",
      icon: Target,
      rawValue: data.pipelinePence,
      isCurrency: true,
      currency,
      badge: undefined,
      sub: `${data.pipelineCount} open quote${data.pipelineCount === 1 ? "" : "s"}`,
      accent: "neutral",
      href: "/app/quotes",
      testId: "kpi-pipeline",
    },
    {
      label: "Jobs Completed",
      icon: CheckSquare,
      rawValue: data.jobsCompletedThisMonth,
      isCurrency: false,
      badge: undefined,
      sub: `${data.avgJobValuePence > 0 ? `avg ${fmtGbp(data.avgJobValuePence, currency)}` : "this month"}`,
      accent: "success",
      href: "/app/jobs",
      testId: "kpi-jobs-completed",
    },
    {
      label: "Jobs Scheduled",
      icon: Briefcase,
      rawValue: data.jobsScheduledCount,
      isCurrency: false,
      badge: undefined,
      sub: "active or upcoming",
      accent: "neutral",
      href: "/app/jobs",
      testId: "kpi-jobs-scheduled",
    },
  ];

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-3 lg:grid-cols-7 sm:overflow-visible sm:pb-0 sm:snap-none"
      data-testid="financial-summary"
    >
      {tiles.map((tile, idx) => (
        <div key={tile.testId} className="snap-start shrink-0 sm:shrink sm:w-auto">
          <KpiCard tile={tile} idx={idx} />
        </div>
      ))}
    </div>
  );
}

/* ─── Financial chart (Revenue vs Collected) ─── */
type Period = "daily" | "weekly" | "monthly" | "quarterly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

function periodRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);
  if (p === "daily") from.setDate(from.getDate() - 30);
  else if (p === "weekly") from.setDate(from.getDate() - 84);
  else if (p === "monthly") { from.setMonth(from.getMonth() - 6); from.setDate(1); }
  else { from.setMonth(from.getMonth() - 12); from.setDate(1); }
  return { from, to: now };
}

interface TimelinePoint {
  bucket: string;
  invoicedPence: number;
  collectedPence: number;
}

function bucketData(timeline: TimelinePoint[], period: Period): TimelinePoint[] {
  if (period === "daily" || period === "monthly") return timeline;
  const grouped: Record<string, { invoicedPence: number; collectedPence: number }> = {};
  for (const pt of timeline) {
    const d = new Date(pt.bucket);
    let key: string;
    if (period === "weekly") {
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      key = ws.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    }
    if (!grouped[key]) grouped[key] = { invoicedPence: 0, collectedPence: 0 };
    grouped[key].invoicedPence += pt.invoicedPence;
    grouped[key].collectedPence += pt.collectedPence;
  }
  return Object.entries(grouped).map(([bucket, v]) => ({ bucket, ...v }));
}

interface ReportRevenueSummary {
  totalInvoicedPence: number;
  totalCollectedPence: number;
  timeline: TimelinePoint[];
}

function insightFromRevenue(data: ReportRevenueSummary | undefined): string {
  if (!data || data.totalInvoicedPence === 0) return "No revenue data available for this period.";
  const pct = Math.round((data.totalCollectedPence / data.totalInvoicedPence) * 100);
  if (data.timeline.length >= 4) {
    const half = Math.floor(data.timeline.length / 2);
    const first = data.timeline.slice(0, half).reduce((s, p) => s + p.invoicedPence, 0);
    const second = data.timeline.slice(half).reduce((s, p) => s + p.invoicedPence, 0);
    if (first > 0) {
      const delta = Math.round(((second - first) / first) * 100);
      if (delta > 0) return `Revenue up ${delta}% in the second half of this period — collection rate ${pct}%.`;
      if (delta < 0) return `Revenue down ${Math.abs(delta)}% in the second half of this period — collection rate ${pct}%.`;
    }
  }
  return `Collection rate ${pct}% — ${fmtGbp(data.totalCollectedPence)} collected of ${fmtGbp(data.totalInvoicedPence)} invoiced.`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold mb-1 text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-foreground font-medium">{p.name}: {fmtGbp(p.value * 100)}</span>
        </div>
      ))}
    </div>
  );
}

function FinancialChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const { from, to } = periodRange(period);
  const { data, isLoading } = useGetReportRevenue({ from: from.toISOString(), to: to.toISOString() });

  const chartData = data
    ? bucketData(data.timeline, period).map((pt) => ({
        date: pt.bucket.slice(0, 10),
        Revenue: pt.invoicedPence / 100,
        Collected: pt.collectedPence / 100,
      }))
    : [];

  const insight = insightFromRevenue(data);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-heading">Revenue Performance</CardTitle>
              <CardDescription className="text-xs mt-0.5">Invoiced revenue vs collected — chart shows billing momentum</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-xl p-1">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No revenue data for this period.</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(46, 98%, 52%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(46, 98%, 52%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    stroke="hsl(46, 98%, 42%)"
                    strokeWidth={2}
                    fill="url(#gradRevenue)"
                    isAnimationActive
                    animationDuration={800}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: "hsl(46, 98%, 52%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Collected"
                    stroke="hsl(152, 60%, 40%)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={900}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: "hsl(152, 60%, 40%)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {!isLoading && data && (
            <div className="flex items-start gap-2 mt-3 px-1 text-xs text-muted-foreground border-t border-border pt-3">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{insight}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Activity feed ─── */
const KIND_ICONS: Record<string, typeof Bell> = {
  invoice: ReceiptText,
  payment: BadgePoundSterling,
  quote: FileText,
  job: Briefcase,
  alert: AlertTriangle,
  default: Bell,
};

const KIND_COLORS: Record<string, string> = {
  invoice: "text-blue-500",
  payment: "text-green-500",
  quote: "text-purple-500",
  job: "text-primary",
  alert: "text-destructive",
  default: "text-muted-foreground",
};

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  message: string;
  linkPath?: string | null;
  createdAt: string;
}

function ActivityFeed() {
  const { data, isLoading } = useListStaffNotifications();
  const items: NotificationItem[] = Array.isArray(data) ? (data as NotificationItem[]).slice(0, 12) : [];

  return (
    <Card className="border-border rounded-2xl shadow-sm flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activity Feed
          </CardTitle>
          <Link href="/app/inbox">
            <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-y-auto max-h-72 pr-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
            <div className="space-y-3">
              {items.map((item, idx) => {
                const kindKey = (item.kind ?? "default").toLowerCase();
                const matchedKey = Object.keys(KIND_ICONS).find((k) => kindKey.includes(k)) ?? "default";
                const Icon = KIND_ICONS[matchedKey];
                const color = KIND_COLORS[matchedKey];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-start gap-3"
                  >
                    <div className={`shrink-0 mt-0.5 rounded-full p-1 bg-card border border-border ${color}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground leading-snug truncate">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground leading-snug truncate">{item.message}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{relativeTime(item.createdAt)}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Today's jobs ─── */
const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  "in-progress": { label: "In Progress", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  in_progress: { label: "In Progress", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  completed: { label: "Completed", cls: "bg-green-500/10 text-green-600 border-green-500/20" },
  overdue: { label: "Overdue", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status.toLowerCase()] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-md whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

interface JobSummaryItem {
  id: string;
  title: string;
  customerName: string;
  assignedUserName?: string | null;
  scheduledStart?: string | null;
  status: string;
}

function TodaysJobs() {
  const { data: jobs, isLoading } = useListJobs();
  const todayJobs = ((jobs ?? []) as JobSummaryItem[]).filter((j) => isToday(j.scheduledStart)).slice(0, 6);

  return (
    <Card className="border-border rounded-2xl shadow-sm flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Jobs
          </CardTitle>
          <Link href="/app/schedule">
            <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-0.5">
              Schedule <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-y-auto max-h-72">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No jobs scheduled today.</div>
        ) : (
          <div className="space-y-2">
            {todayJobs.map((job, idx) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link href={`/app/jobs/${job.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{job.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{job.customerName}</div>
                    </div>
                    {job.assignedUserName && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md shrink-0 max-w-20 truncate">
                        {job.assignedUserName.split(" ")[0]}
                      </span>
                    )}
                    {job.scheduledStart && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {new Date(job.scheduledStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <StatusChip status={job.status} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── AI insights panel ─── */
type InsightSeverity = "warn" | "info" | "success";

function InsightsPanel() {
  const { data: financial } = useGetFinancialSummary();
  const { data: jobs } = useListJobs();
  const { data: attention } = useGetExpiryAttention();

  const insights: Array<{ text: string; severity: InsightSeverity }> = [];

  if (financial) {
    if (financial.overdueCount > 0) {
      insights.push({
        text: `${financial.overdueCount} invoice${financial.overdueCount === 1 ? "" : "s"} overdue — ${fmtGbp(financial.overduePence, financial.currency)} outstanding`,
        severity: "warn",
      });
    }
    if (financial.revenueLastMonthPence > 0) {
      const pct = Math.round(((financial.revenueThisMonthPence - financial.revenueLastMonthPence) / financial.revenueLastMonthPence) * 100);
      if (pct > 0) insights.push({ text: `Revenue up ${pct}% vs last month`, severity: "success" });
      else if (pct < -10) insights.push({ text: `Revenue down ${Math.abs(pct)}% vs last month — review pipeline`, severity: "warn" });
    }
    if (financial.pipelineCount > 0) {
      insights.push({
        text: `${financial.pipelineCount} open quote${financial.pipelineCount === 1 ? "" : "s"} worth ${fmtGbp(financial.pipelinePence, financial.currency)} in pipeline`,
        severity: "info",
      });
    }
  }

  if (attention && attention.expiredCount > 0) {
    insights.push({
      text: `${attention.expiredCount} compliance item${attention.expiredCount === 1 ? "" : "s"} already expired — action required`,
      severity: "warn",
    });
  }

  const todayJobs = ((jobs ?? []) as JobSummaryItem[]).filter((j) => isToday(j.scheduledStart));
  if (todayJobs.length > 0) {
    insights.push({ text: `${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} scheduled today`, severity: "info" });
  }

  const shown = insights.slice(0, 3);
  if (shown.length === 0) return null;

  const SEVERITY_STYLE: Record<InsightSeverity, string> = {
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    info: "border-primary/20 bg-primary/5 text-primary",
    success: "border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary font-heading">AI Insights</span>
        </div>
        <div className="space-y-2">
          {shown.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.07 }}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${SEVERITY_STYLE[ins.severity]}`}
            >
              <Sparkles className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
              {ins.text}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Restyled preserved cards ─── */

function AttentionRequiredCard() {
  const { data, isLoading } = useGetExpiryAttention();
  if (isLoading || !data) return null;
  if (data.expiredCount === 0 && data.expiringCount === 0) return null;
  return (
    <Card className="border-destructive/30 rounded-2xl shadow-sm bg-destructive/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Attention Required
            </CardTitle>
            <CardDescription>
              Certificates, MOT, tax and service items expiring within {data.windowDays} days — and any already expired.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="px-2 py-1 text-xs font-bold bg-destructive/20 text-destructive font-mono rounded-lg">
              {data.expiredCount} expired
            </div>
            <div className="px-2 py-1 text-xs font-bold bg-primary/20 text-primary font-mono rounded-lg">
              {data.expiringCount} expiring
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
          {data.items.slice(0, 6).map((item) => (
            <Link key={`${item.kind}-${item.recordId}`} href={item.href}>
              <div className="flex items-center justify-between gap-4 p-3 hover:bg-muted/40 cursor-pointer transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className={`h-4 w-4 shrink-0 ${item.expired ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{item.label}</div>
                    {item.reference && <div className="text-xs text-muted-foreground truncate font-mono">{item.reference}</div>}
                  </div>
                </div>
                <div className="text-xs font-mono shrink-0 text-right">
                  {item.expired ? (
                    <span className="text-destructive font-bold">Expired {Math.abs(item.daysUntil)}d ago</span>
                  ) : (
                    <span className="text-foreground">Due in {item.daysUntil}d</span>
                  )}
                  <div className="text-muted-foreground">{new Date(item.expiresAt).toLocaleDateString()}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {data.items.length > 6 && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            + {data.items.length - 6} more — review on Compliance and Fleet.
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Link href="/app/compliance">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">Compliance</Button>
        </Link>
        <Link href="/app/fleet">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">Fleet</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function InboxTile() {
  const { data: unread } = useGetInboxUnreadCount();
  const { data: threadsData, isLoading } = useListInboxThreads();
  const threads = (threadsData?.threads ?? []).slice(0, 5);
  if (isLoading && threads.length === 0) return null;
  const unreadCount = unread?.count ?? 0;
  return (
    <Card className="border-border rounded-2xl shadow-sm" data-testid="card-inbox">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-5 w-5" /> Inbox
            </CardTitle>
            <CardDescription>
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : "All caught up."}
            </CardDescription>
          </div>
          <Link href="/app/inbox">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold" data-testid="link-inbox-open">Open inbox</Button>
          </Link>
        </div>
      </CardHeader>
      {threads.length > 0 && (
        <CardContent className="pt-0">
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {threads.map((t) => (
              <Link key={t.id} href="/app/inbox">
                <div className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`row-inbox-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold truncate">
                      <span className="text-xs text-muted-foreground">{t.channel}</span>
                      <span className="truncate">{t.customerName ?? t.customerEmail ?? "(unknown)"}</span>
                      {t.unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{t.lastMessagePreview ?? t.subject ?? ""}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 font-mono">
                    {new Date(t.lastMessageAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function LeadSourceRoiCard() {
  const { data, isLoading } = useGetLeadSourceRoi();
  if (isLoading || !data) return null;
  if (data.totalLeads === 0) return null;
  const fmt = (p: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: data.currency, maximumFractionDigits: 0 }).format(p / 100);
  return (
    <Card className="border-border rounded-2xl shadow-sm" data-testid="card-lead-source-roi">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5" /> Lead Source ROI
            </CardTitle>
            <CardDescription>
              {data.totalLeads} lead{data.totalLeads === 1 ? "" : "s"} · {data.wonLeads} won · {fmt(data.wonValuePence)} closed · {fmt(data.pipelineValuePence)} in pipeline
            </CardDescription>
          </div>
          <Link href="/app/leads">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">All leads</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
          {data.rows.map((r) => (
            <div key={r.source} className="grid grid-cols-12 gap-2 p-3 text-sm items-center">
              <div className="col-span-3 font-mono font-bold">{r.source}</div>
              <div className="col-span-2 text-muted-foreground">{r.totalLeads} leads</div>
              <div className="col-span-2 text-muted-foreground">{r.wonLeads} won</div>
              <div className="col-span-2 font-mono">{r.conversionPct}%</div>
              <div className="col-span-3 text-right font-mono font-bold">{fmt(r.wonValuePence)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IndustryTourBanner() {
  const { data: tour, isLoading } = useGetIndustryTour();
  const dismiss = useDismissIndustryTour();
  const queryClient = useQueryClient();

  if (isLoading || !tour || tour.dismissed) return null;

  const handleDismiss = () => {
    dismiss.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(
          ["/api/v1/onboarding/industry-tour"],
          (old: typeof tour) => (old ? { ...old, dismissed: true } : old),
        );
      },
    });
  };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm rounded-2xl" data-testid="industry-tour-banner">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-lg">
                Your workspace is ready
                {tour.industryName && (
                  <span className="ml-2 text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 border border-primary/20 rounded-lg">
                    {tour.industryName}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                We've pre-populated your workspace with industry-specific content. Here's where to start.
              </CardDescription>
              {tour.enabledModules.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tour.enabledModules.map((mod: string) => (
                    <span key={mod} className="text-[10px] font-bold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 font-mono rounded-md">
                      {mod}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 w-8 p-0 rounded-xl hover:bg-primary/10"
            onClick={handleDismiss}
            disabled={dismiss.isPending}
            aria-label="Dismiss onboarding tour"
            data-testid="industry-tour-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tour.quickActions.map((action: { key: string; label: string; description: string; href: string }) => (
            <Link key={action.key} href={action.href}>
              <div
                className="flex items-start justify-between gap-3 p-3 border border-border bg-background hover:bg-muted/40 cursor-pointer group rounded-xl transition-colors"
                data-testid={`industry-tour-action-${action.key}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight">{action.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{action.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main dashboard ─── */
export function AppDashboard() {
  const { data: onboarding, isLoading: isLoadingOnboarding } = useGetOnboarding();
  const { isFetching: isFetchingFinancial } = useGetFinancialSummary();

  if (isLoadingOnboarding) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <div className="flex gap-3 overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="min-w-[160px] sm:min-w-0">
              <Skeleton className="h-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <GreetingHeader isFetching={isFetchingFinancial} />

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <KpiStrip />
      </motion.section>

      <IndustryTourBanner />

      <FinancialChart />

      <InsightsPanel />

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <ActivityFeed />
        <TodaysJobs />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <AttentionRequiredCard />
      </motion.div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <InboxTile />
        <LeadSourceRoiCard />
      </motion.div>

      {onboarding && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="border-border rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading">Onboarding Protocol</CardTitle>
              <CardDescription>Complete these steps to fully activate your tenant workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm font-bold font-mono">
                  <span>{onboarding.percentComplete}% Complete</span>
                </div>
                <Progress value={onboarding.percentComplete} className="h-2 bg-muted [&>div]:bg-primary" />
              </div>
              <div className="space-y-3">
                {onboarding.items.map((item) => (
                  <div key={item.key} className="flex items-start gap-4 p-4 border border-border bg-background rounded-xl">
                    {item.complete ? (
                      <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-bold ${item.complete ? "line-through text-muted-foreground" : ""}`}>{item.label}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                    {!item.complete && item.href && (
                      <Link href={item.href}>
                        <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold shrink-0">
                          Action
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
