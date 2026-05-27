import { useGetTenantUsage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from "lucide-react";

/** Included monthly allowances per plan tier. Kept inline so the tile is
 *  self-contained; once plan metadata moves server-side this should be fetched. */
const INCLUDED_LIMITS: Record<string, number> = {
  email: 5000,
  sms: 500,
  whatsapp: 500,
  ai_call: 10000,
  voice_minute: 200,
  api_call: 100000,
  pdf_generated: 1000,
  file_uploaded: 2000,
};

const KIND_LABELS: Record<string, string> = {
  email: "Emails",
  sms: "SMS",
  whatsapp: "WhatsApp",
  ai_call: "AI tokens",
  voice_minute: "Voice mins",
  api_call: "API calls",
  pdf_generated: "PDFs",
  file_uploaded: "Files",
};

export function UsageTile() {
  const { data, isLoading } = useGetTenantUsage();
  if (isLoading || !data) return null;

  // Always render the included kinds so users see their allowance even at 0.
  const counts = new Map<string, number>(data.rows.map((r) => [r.kind, r.count]));
  const kinds = Object.keys(INCLUDED_LIMITS);

  return (
    <Card className="rounded-none border-border shadow-sm" data-testid="card-usage">
      <CardHeader>
        <CardTitle className="uppercase tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5" /> Usage this month
        </CardTitle>
        <CardDescription>
          Current period vs your plan's included allowance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kinds.map((kind) => {
            const used = counts.get(kind) ?? 0;
            const limit = INCLUDED_LIMITS[kind] ?? 0;
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const over = limit > 0 && used > limit;
            return (
              <div key={kind} className="border border-border p-3 bg-background">
                <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
                  {KIND_LABELS[kind] ?? kind}
                </div>
                <div className="text-xl font-mono font-bold" data-testid={`usage-${kind}`}>
                  {used.toLocaleString()}
                  <span className="text-xs text-muted-foreground font-normal"> / {limit.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-muted">
                  <div
                    className={`h-full ${over ? "bg-red-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
