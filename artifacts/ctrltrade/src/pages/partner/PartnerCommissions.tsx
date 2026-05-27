import { useListPartnerCommissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function pounds(p: number) { return `£${(p / 100).toFixed(2)}`; }

export function PartnerCommissions() {
  const { data, isLoading } = useListPartnerCommissions({});
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Commissions</h1>
      <Card className=" border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Earnings</CardTitle></CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No commissions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Tenant</th><th className="text-left py-2">Period</th><th className="text-left py-2">Invoice</th><th className="text-left py-2">Commission</th><th className="text-left py-2">Status</th>
              </tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 font-medium">{c.tenantName}</td>
                    <td className="py-2">{new Date(c.periodStart).toLocaleDateString()} – {new Date(c.periodEnd).toLocaleDateString()}</td>
                    <td className="py-2">{c.invoiceTotalPence != null ? pounds(c.invoiceTotalPence) : "—"}</td>
                    <td className="py-2 font-bold">{pounds(c.commissionPence)}</td>
                    <td className="py-2"><Badge variant={c.status === "paid" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{c.status}</Badge></td>
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
