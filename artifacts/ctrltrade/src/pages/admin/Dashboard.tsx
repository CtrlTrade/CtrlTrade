import { useGetAdminDashboard, useGetRevenueBreakdown, useGetAdminActivity, useGetUpcomingRenewals, useGetAdminUsage, useGetAdminLeadsPipelineSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, AlertCircle, RefreshCw, Activity, Gauge, Funnel } from "lucide-react";
import { Link } from "wouter";

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

export function AdminDashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetAdminDashboard();
  const { data: revenue, isLoading: revLoading } = useGetRevenueBreakdown();
  const { data: activity, isLoading: actLoading } = useGetAdminActivity();
  const { data: renewals, isLoading: renLoading } = useGetUpcomingRenewals();
  const { data: usage } = useGetAdminUsage();
  const { data: pipeline } = useGetAdminLeadsPipelineSummary();

  if (dashLoading || revLoading || actLoading || renLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter text-white">System Operator Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR" value={`£${dashboard.mrr.toLocaleString()}`} icon={CreditCard} highlight />
        <KpiCard title="ARR" value={`£${dashboard.arr.toLocaleString()}`} icon={CreditCard} />
        <KpiCard title="Active Tenants" value={dashboard.activeTenants} icon={Users} />
        <KpiCard title="Active Trials" value={dashboard.activeTrials} icon={Activity} />
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Control Seats" value={dashboard.activeControlSeats} icon={Users} />
        <KpiCard title="Field Seats" value={dashboard.activeFieldSeats} icon={Users} />
        <KpiCard title="POS Tills" value={dashboard.activeTills} icon={CreditCard} />
        <div className="grid grid-cols-2 gap-4">
          <KpiCard title="Past Due" value={dashboard.pastDue} icon={AlertCircle} className="bg-red-950/20 border-red-900/50 text-red-500" />
          <KpiCard title="Failed (30d)" value={dashboard.failedPaymentsLast30d} icon={AlertCircle} className="bg-red-950/20 border-red-900/50 text-red-500" />
        </div>
      </div>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2">
            <Gauge className="h-4 w-4" /> Platform usage this month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usage && usage.totals.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {usage.totals.map((t) => (
                <Link key={t.kind} href="/admin/usage" className="border border-zinc-800 p-3 bg-zinc-950 hover:border-red-500/50 transition-colors block" data-testid={`admin-usage-${t.kind}`}>
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500 mb-1">
                    {USAGE_KIND_LABELS[t.kind] ?? t.kind}
                  </div>
                  <div className="text-xl font-mono font-bold text-zinc-100">{t.count.toLocaleString()}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500 font-mono">
              No usage recorded yet this month. <Link href="/admin/usage" className="text-red-500 hover:underline">View breakdown →</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100">Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {revenue?.lines.map((line, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-zinc-300">{line.label} <span className="text-zinc-500 font-normal">({line.units} units)</span></span>
                      <span className="font-mono text-zinc-100">£{line.amount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900">
                      <div className="h-full bg-red-500" style={{ width: `${Math.max(2, (line.amount / dashboard.mrr) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2"><RefreshCw className="h-4 w-4"/> Upcoming Renewals (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              {renewals && renewals.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {renewals.map(ren => (
                    <div key={ren.tenantId} className="py-3 flex justify-between items-center">
                      <div>
                        <Link href={`/tenants/${ren.tenantId}`} className="font-bold text-zinc-200 hover:text-red-500 uppercase text-sm">
                          {ren.tenantName}
                        </Link>
                        <div className="text-xs text-zinc-500 font-mono mt-1">{new Date(ren.renewsAt).toLocaleDateString()}</div>
                      </div>
                      <div className="font-mono text-zinc-300">£{ren.amount}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-600 font-mono text-sm">No upcoming renewals in next 7 days.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-none border-zinc-800 bg-black shadow-none h-full">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 flex items-center gap-2"><Activity className="h-4 w-4"/> System Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activity?.map(act => (
                  <div key={act.id} className="border-l-2 border-red-500 pl-4 py-1">
                    <div className="text-xs text-zinc-500 font-mono mb-1">{new Date(act.createdAt).toLocaleString()}</div>
                    <div className="text-sm text-zinc-300">{act.message}</div>
                    {act.tenantName && (
                      <div className="text-xs font-bold uppercase text-red-500/80 mt-1">{act.tenantName}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, className = "", highlight = false }: any) {
  return (
    <Card className={`rounded-none border-zinc-800 shadow-none ${highlight ? 'bg-zinc-900 border-red-500/50' : 'bg-black'} ${className}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="font-bold uppercase tracking-wider text-xs text-zinc-400">{title}</div>
          <Icon className={`h-4 w-4 ${highlight ? 'text-red-500' : 'text-zinc-600'}`} />
        </div>
        <div className={`text-3xl font-mono font-bold ${highlight ? 'text-red-500' : 'text-zinc-100'}`} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
