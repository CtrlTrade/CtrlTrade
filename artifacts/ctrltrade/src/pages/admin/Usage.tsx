import { useGetAdminUsage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Activity } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export function AdminUsage() {
  const { data, isLoading } = useGetAdminUsage();

  if (isLoading || !data) return <div className="p-8 space-y-4"><Skeleton className="h-32"/><Skeleton className="h-96"/></div>;

  const fmtRange = `${new Date(data.periodStart).toLocaleDateString()} – ${new Date(data.periodEnd).toLocaleDateString()}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Usage Metering"
        subtitle={fmtRange}
        icon={<Activity className="h-6 w-6" />}
      />

      <Card className="rounded-xl border-border bg-black shadow-none">
        <CardHeader>
          <CardTitle className=" text-foreground">Totals This Month</CardTitle>
          <CardDescription>Emails, SMS, AI calls, files uploaded — across all tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.totals.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground font-mono text-sm">No usage recorded this month.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.totals.map(t => (
                <div key={t.kind} className="border border-border p-4 bg-background">
                  <div className="font-bold text-xs text-muted-foreground mb-2">{t.kind}</div>
                  <div className="text-2xl font-mono font-bold text-foreground" data-testid={`usage-total-${t.kind}`}>{t.count.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-black shadow-none">
        <CardHeader><CardTitle className=" text-foreground">By Tenant</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-800 border border-border">
            {data.byTenant.map(t => (
              <div key={t.tenantId} className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <Link href={`/tenants/${t.tenantId}`} className="font-bold text-foreground/90 hover:text-red-500 uppercase text-sm">{t.tenantName}</Link>
                  <div className="font-mono text-foreground font-bold">{t.total.toLocaleString()}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.rows.map(r => (
                    <div key={r.kind} className="text-xs font-mono bg-card border border-border px-2 py-1">
                      <span className="text-muted-foreground">{r.kind}</span>{" "}
                      <span className="text-foreground font-bold">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.byTenant.length === 0 && <div className="p-6 text-center text-muted-foreground font-mono text-sm">No tenants have generated usage yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
