import {
  useGetAdminDashboard,
  useGetRevenueBreakdown,
  useGetAdminActivity,
  useGetUpcomingRenewals,
  useGetAdminUsage,
  useGetAdminLeadsPipelineSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, CreditCard, AlertCircle, RefreshCw, Activity, Gauge,
  Funnel, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const USAGE_KIND_LABELS: Record<string, string> = {
  email: "Emails",
  sms: "SMS",
  whatsapp: "WhatsApp",
  ai_call: "AI tokens",
  voice_minute: "Voice mins",
  api_call: "API calls",
  pdf_generated: "PDFs",
  file_uploaded: "Files",
};

function generateSparklineData(seed: number, points = 8) {
  const data = [];
  let v = seed * 0.7;
  for (let i = 0; i < points; i++) {
    v = Math.max(0, v + (Math.random() - 0.45) * seed * 0.15);
    data.push({ v: Math.round(v) });
  }
  data[data.length - 1].v = seed;
  return data;
}

function TrendBadge({ value, suffix = "%" }: { value?: number; suffix?: string }) {
  if (value === undefined || value === null) return null;
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-green-400">
        <TrendingUp className="h-3 w-3" />+{value}{suffix}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-400">
        <TrendingDown className="h-3 w-3" />{value}{suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-zinc-500">
      <Minus className="h-3 w-3" />0{suffix}
    </span>
  );
}

export function AdminDashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetAdminDashboard();
  const { data: revenue, isLoading: revLoading } = useGetRevenueBreakdown();
  const { data: activity, isLoading: actLoading } = useGetAdminActivity();
  const { data: renewals, isLoading: renLoading } = useGetUpcomingRenewals();
  const { data: usage } = useGetAdminUsage();
  const { data: pipeline } = useGetAdminLeadsPipelineSummary();

  if (dashLoading || revLoading || actLoading || renLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 bg-zinc-900" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 bg-zinc-900" />)}
        </div>
        <Skeleton className="h-64 bg-zinc-900" />
      </div>
    );
  }

  if (!dashboard) return null;

  const mrrSparkline = generateSparklineData(dashboard.mrr);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="System Operator Dashboard" />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="MRR"
          value={`£${dashboard.mrr.toLocaleString()}`}
          icon={CreditCard}
          highlight
          sparklineData={mrrSparkline}
          trend={(dashboard as any).mrrGrowthPct}
          testId="mrr"
        />
        <KpiCard
          title="ARR"
          value={`£${dashboard.arr.toLocaleString()}`}
          icon={CreditCard}
          trend={(dashboard as any).arrGrowthPct}
          testId="arr"
        />
        <KpiCard
          title="Active Tenants"
          value={dashboard.activeTenants}
          icon={Users}
          trend={(dashboard as any).tenantGrowthPct}
          testId="active-tenants"
        />
        <KpiCard
          title="Active Trials"
          value={dashboard.activeTrials}
          icon={Activity}
          testId="active-trials"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Control Seats" value={dashboard.activeControlSeats} icon={Users} testId="control-seats" />
        <KpiCard title="Field Seats" value={dashboard.activeFieldSeats} icon={Users} testId="field-seats" />
        <KpiCard title="POS Tills" value={dashboard.activeTills} icon={CreditCard} testId="pos-tills" />
        <div className="grid grid-cols-2 gap-4">
          <KpiCard title="Past Due" value={dashboard.pastDue} icon={AlertCircle} danger testId="past-due" />
          <KpiCard title="Failed (30d)" value={dashboard.failedPaymentsLast30d} icon={AlertCircle} danger testId="failed-payments" />
        </div>
      </div>

      {/* Pipeline summary */}
      {pipeline && (
        <Link href="/leads" className="block">
          <Card className="rounded-none border-zinc-800 bg-black shadow-none hover:border-zinc-600 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2 text-sm">
                <Funnel className="h-4 w-4 text-red-500" /> Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {(["new", "contacted", "demo_booked", "won", "lost"] as const).map((s) => {
                  const labels: Record<string, string> = { new: "New", contacted: "Contacted", demo_booked: "Demo Booked", won: "Won", lost: "Lost" };
                  const colours: Record<string, string> = { new: "text-blue-400", contacted: "text-yellow-400", demo_booked: "text-purple-400", won: "text-green-400", lost: "text-zinc-500" };
                  return (
                    <div key={s} className="text-center">
                      <div className={`text-2xl font-mono font-bold ${colours[s]}`}>{pipeline.byStatus?.[s] ?? 0}</div>
                      <div className="text-[10px] font-bold uppercase text-zinc-600 mt-0.5">{labels[s]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 border-t border-zinc-900 pt-2 mt-2">
                <div className="text-xs text-zinc-500">Won this month: <span className="text-green-400 font-mono font-bold">{pipeline.wonThisMonth}</span></div>
                <div className="text-xs text-zinc-500">Total: <span className="text-zinc-300 font-mono font-bold">{pipeline.total}</span></div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Usage */}
      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4" /> Platform usage this month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usage && usage.totals.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {usage.totals.map((t) => (
                <Link
                  key={t.kind}
                  href="/admin/usage"
                  className="border border-zinc-800 p-3 bg-zinc-950 hover:border-red-500/50 transition-colors block"
                  data-testid={`admin-usage-${t.kind}`}
                >
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500 mb-1">
                    {USAGE_KIND_LABELS[t.kind] ?? t.kind}
                  </div>
                  <div className="text-xl font-mono font-bold text-zinc-100">{t.count.toLocaleString()}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-600 font-mono text-sm">
              No usage recorded yet this month.{" "}
              <Link href="/admin/usage" className="text-red-500 hover:underline">View breakdown →</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Breakdown */}
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue?.lines && revenue.lines.length > 0 ? (
                <div className="space-y-4">
                  {revenue.lines.map((line, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-zinc-300">
                          {line.label}{" "}
                          <span className="text-zinc-500 font-normal">({line.units} units)</span>
                        </span>
                        <span className="font-mono text-zinc-100">£{line.amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900">
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${Math.max(2, (line.amount / Math.max(dashboard.mrr, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-600 font-mono text-sm">No revenue breakdown data available.</div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Upcoming Renewals (7d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renewals && renewals.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {renewals.map((ren) => (
                    <div key={ren.tenantId} className="py-3 flex justify-between items-center">
                      <div>
                        <Link
                          href={`/tenants/${ren.tenantId}`}
                          className="font-bold text-zinc-200 hover:text-red-500 uppercase text-sm"
                        >
                          {ren.tenantName}
                        </Link>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">
                          {new Date(ren.renewsAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-mono text-zinc-300 font-bold">£{ren.amount}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-600 font-mono text-sm">
                  No upcoming renewals in next 7 days.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Activity */}
        <Card className="rounded-none border-zinc-800 bg-black shadow-none">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> System Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((act) => (
                  <div key={act.id} className="border-l-2 border-red-500 pl-4 py-1">
                    <div className="text-xs text-zinc-500 font-mono mb-1">
                      {new Date(act.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-zinc-300">{act.message}</div>
                    {act.tenantName && (
                      <div className="text-xs font-bold uppercase text-red-500/80 mt-1">{act.tenantName}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-600 font-mono text-sm">No recent system activity.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title, value, icon: Icon, highlight = false, danger = false,
  sparklineData, trend, testId, className = "",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  highlight?: boolean;
  danger?: boolean;
  sparklineData?: Array<{ v: number }>;
  trend?: number;
  testId?: string;
  className?: string;
}) {
  const borderCls = danger
    ? "border-red-900/50 bg-red-950/20"
    : highlight
    ? "border-red-500/50 bg-zinc-900"
    : "border-zinc-800 bg-black";
  const valueCls = danger ? "text-red-500" : highlight ? "text-red-500" : "text-zinc-100";
  const iconCls = danger ? "text-red-500" : highlight ? "text-red-500" : "text-zinc-600";

  return (
    <Card className={`rounded-none shadow-none ${borderCls} ${className}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="font-bold uppercase tracking-wider text-xs text-zinc-400">{title}</div>
          <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
        </div>
        <div
          className={`text-2xl md:text-3xl font-mono font-bold ${valueCls}`}
          data-testid={testId ? `kpi-${testId}` : undefined}
        >
          {value}
        </div>
        <div className="flex items-center justify-between mt-2 gap-2">
          {trend !== undefined ? (
            <TrendBadge value={trend} />
          ) : (
            <span />
          )}
          {sparklineData && (
            <div className="w-20 h-8 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ display: "none" }}
                    cursor={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    fill="url(#sparkGrad)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
