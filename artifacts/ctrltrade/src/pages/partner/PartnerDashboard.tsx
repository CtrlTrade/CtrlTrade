import { useGetPartnerDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function pounds(p: number) { return `£${(p / 100).toFixed(2)}`; }

export function PartnerDashboard() {
  const { data, isLoading } = useGetPartnerDashboard();
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const t = data.totals;
  const stats = [
    { label: "Clicks", value: t.clicks },
    { label: "Leads", value: t.leads },
    { label: "Sign-ups", value: t.signups },
    { label: "Paying", value: t.paying },
    { label: "Accrued", value: pounds(t.accruedPence) },
    { label: "Paid out", value: pounds(t.paidPence) },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Partner Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-none border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, '-')}`}>{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Recent Conversions</CardTitle></CardHeader>
        <CardContent>
          {data.conversions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No referrals yet — share your link to start tracking.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left py-2">Tenant</th><th className="text-left py-2">Status</th><th className="text-left py-2">First paid</th><th className="text-left py-2">Signed up</th></tr>
              </thead>
              <tbody>
                {data.conversions.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 font-medium">{c.tenantName}</td>
                    <td className="py-2"><Badge variant={c.status === "paying" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{c.status}</Badge></td>
                    <td className="py-2">{c.firstPaidAt ? new Date(c.firstPaidAt).toLocaleDateString() : "—"}</td>
                    <td className="py-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
