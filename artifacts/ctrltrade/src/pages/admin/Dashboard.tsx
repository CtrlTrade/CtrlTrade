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
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from "recharts";
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
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
        <TrendingDown className="h-3 w-3" />{value}{suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted-foreground">
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
        <Skeleton className="h-12 w-64 bg-card" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 bg-card" />)}
        </div>
        <Skeleton className="h-64 bg-card" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="System operator dashboard" />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="MRR"
          value={`£${dashboard.mrr.toLocaleString()}`}
          icon={CreditCard}
          highlight
          trend={(dashboard as any).mrrGrowthPct as number | undefined}
          testId="mrr"
        />
        <KpiCard
          title="ARR"
          value={`£${dashboard.arr.toLocaleString()}`}
          icon={CreditCard}
          trend={(dashboard as any).arrGrowthPct as number | undefined}
          testId="arr"
        />
        <KpiCard
          title="Active tenants"
          value={dashboard.activeTenants}
          icon={Users}
          trend={(dashboard as any).tenantGrowthPct as number | undefined}
          testId="active-tenants"
        />
        <KpiCard
          title="Active trials"
          value={dashboard.activeTrials}
          icon={Activity}
          testId="active-trials"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Control seats" value={dashboard.activeControlSeats} icon={Users} testId="control-seats" />
        <KpiCard title="Field seats" value={dashboard.activeFieldSeats} icon={Users} testId="field-seats" />
        <KpiCard title="POS tills" value={dashboard.activeTills} icon={CreditCard} testId="pos-tills" />
        <div className="grid grid-cols-2 gap-4">
          <KpiCard title="Past due" value={dashboard.pastDue} icon={AlertCircle} danger testId="past-due" />
          <KpiCard title="Failed (30d)" value={dashboard.failedPaymentsLast30d} icon={AlertCircle} danger testId="failed-payments" />
        </div>
      </div>

      {/* Pipeline summary */}
      {pipeline && (
        <Link href="/leads" className="block">
          <Card className="rounded-xl border-border bg-card shadow-none hover:border-primary/40 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                <Funnel className="h-4 w-4 text-primary" /> Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {(["new", "contacted", "demo_booked", "won", "lost"] as const).map((s) => {
                  const labels: Record<string, string> = { new: "New", contacted: "Contacted", demo_booked: "Demo booked", won: "Won", lost: "Lost" };
                  const colours: Record<string, string> = { new: "text-blue-400", contacted: "text-yellow-400", demo_booked: "text-purple-400", won: "text-green-400", lost: "text-muted-foreground" };
                  return (
                    <div key={s} className="text-center">
                      <div className={`text-2xl font-mono font-bold ${colours[s]}`}>{pipeline.byStatus?.[s] ?? 0}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{labels[s]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 border-t border-border pt-2 mt-2">
                <div className="text-xs text-muted-foreground">Won this month: <span className="text-green-400 font-mono font-bold">{pipeline.wonThisMonth}</span></div>
                <div className="text-xs text-muted-foreground">Total: <span className="text-foreground/80 font-mono font-bold">{pipeline.total}</span></div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Usage */}
      <Card className="rounded-xl border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4" /> Platform usage this month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usage && usage.totals.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {usage.totals.map((t) => (
                <Link
                  key={t.kind}
                  href="/usage"
                  className="border border-border p-3 bg-background rounded-xl hover:border-primary/50 transition-colors block"
                  data-testid={`admin-usage-${t.kind}`}
                >
                  <div className="font-semibold text-[10px] text-muted-foreground mb-1">
                    {USAGE_KIND_LABELS[t.kind] ?? t.kind}
                  </div>
                  <div className="text-xl font-mono font-bold text-foreground">{t.count.toLocaleString()}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground font-mono text-sm">
              No usage recorded yet this month.{" "}
              <Link href="/usage" className="text-primary hover:underline">View breakdown →</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Breakdown */}
          <Card className="rounded-xl border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-foreground text-sm">Revenue breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue?.lines && revenue.lines.length > 0 ? (
                <div>
                  <div className="h-40 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={revenue.lines.map((l) => ({ name: l.label, amount: l.amount }))}
                        margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                      >
                        <Tooltip
                          contentStyle={{ background: "hsl(220,70%,13%)", border: "1px solid hsl(220,40%,22%)", borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [`£${v.toLocaleString()}`, "Revenue"]}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        />
                        <Bar dataKey="amount" isAnimationActive={false}>
                          {revenue.lines.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? "hsl(46,98%,52%)" : "hsl(46,98%,40%)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {revenue.lines.map((line, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{line.label} <span className="text-muted-foreground">({line.units} units)</span></span>
                        <span className="font-mono text-foreground font-bold">£{line.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground font-mono text-sm">No revenue breakdown data available.</div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card className="rounded-xl border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Upcoming renewals (7d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renewals && renewals.length > 0 ? (
                <div className="divide-y divide-border">
                  {renewals.map((ren) => (
                    <div key={ren.tenantId} className="py-3 flex justify-between items-center">
                      <div>
                        <Link
                          href={`/tenants/${ren.tenantId}`}
                          className="font-semibold text-foreground/90 hover:text-primary text-sm"
                        >
                          {ren.tenantName}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {new Date(ren.renewsAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-mono text-foreground/80 font-bold">£{ren.amount}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground font-mono text-sm">
                  No upcoming renewals in next 7 days.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Activity */}
        <Card className="rounded-xl border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> System activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((act) => (
                  <div key={act.id} className="border-l-2 border-primary/40 pl-4 py-1">
                    <div className="text-xs text-muted-foreground font-mono mb-1">
                      {new Date(act.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-foreground/80">{act.message}</div>
                    {act.tenantName && (
                      <div className="text-xs font-semibold text-primary/70 mt-1">{act.tenantName}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">No recent system activity.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title, value, icon: Icon, highlight = false, danger = false,
  trend, testId, className = "",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  highlight?: boolean;
  danger?: boolean;
  trend?: number;
  testId?: string;
  className?: string;
}) {
  const borderCls = danger
    ? "border-red-500/30 bg-red-500/5"
    : highlight
    ? "border-primary/40 bg-card"
    : "border-border bg-card";
  const valueCls = danger ? "text-red-400" : highlight ? "text-primary" : "text-foreground";
  const iconCls  = danger ? "text-red-400" : highlight ? "text-primary" : "text-muted-foreground";

  return (
    <Card className={`rounded-xl shadow-none ${borderCls} ${className}`} data-testid={testId ? `kpi-${testId}` : undefined}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs text-muted-foreground font-semibold">{title}</span>
          <Icon className={`h-4 w-4 ${iconCls}`} />
        </div>
        <div className={`text-2xl font-mono font-bold ${valueCls}`}>{value}</div>
        {trend !== undefined && (
          <div className="mt-1"><TrendBadge value={trend} /></div>
        )}
      </CardContent>
    </Card>
  );
}
