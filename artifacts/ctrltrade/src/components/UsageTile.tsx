import { useGetTenantUsage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function UsageTile() {
  const { data, isLoading } = useGetTenantUsage();
  if (isLoading || !data) return null;
  return (
    <Card className="rounded-none border-border shadow-sm" data-testid="card-usage">
      <CardHeader>
        <CardTitle className="uppercase tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5"/> Usage this month
        </CardTitle>
        <CardDescription>
          Includes emails sent, files uploaded, and AI/SMS spend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.rows.length === 0 ? (
          <div className="text-sm text-muted-foreground font-mono">No usage recorded yet this month.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.rows.map(r => (
              <div key={r.kind} className="border border-border p-3 bg-background">
                <div className="font-bold uppercase tracking-wider text-xs text-muted-foreground mb-1">{r.kind}</div>
                <div className="text-xl font-mono font-bold" data-testid={`usage-${r.kind}`}>{r.count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
