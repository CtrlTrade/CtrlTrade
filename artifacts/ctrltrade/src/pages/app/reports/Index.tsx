import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetReportInsights } from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  PoundSterling,
  Target,
  Users,
  FileText,
  Briefcase,
  Hourglass,
  Activity,
  Sparkles,
} from "lucide-react";

const CARDS: Array<{ href: string; title: string; description: string; Icon: any }> = [
  { href: "/reports/revenue", title: "Revenue", description: "Invoiced vs collected over time.", Icon: PoundSterling },
  { href: "/reports/lead-roi", title: "Lead ROI", description: "Sources, conversion rate, revenue attributed.", Icon: Target },
  { href: "/reports/engineer-performance", title: "Engineer Performance", description: "Jobs completed, hours, value, on-time %.", Icon: Users },
  { href: "/reports/quote-conversion", title: "Quote Conversion", description: "Sent vs accepted vs converted-to-job.", Icon: FileText },
  { href: "/reports/job-profitability", title: "Job Profitability", description: "Revenue, cost and margin per job.", Icon: Briefcase },
  { href: "/reports/customer-ltv", title: "Customer Lifetime Value", description: "Total invoiced and collected per customer.", Icon: Users },
  { href: "/reports/aged-debtors", title: "Aged Debtors", description: "Outstanding invoices bucketed by overdue age.", Icon: Hourglass },
  { href: "/reports/activity-heatmap", title: "Activity Heatmap", description: "Jobs per day of week × hour.", Icon: Activity },
];

export function ReportsIndex() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregated insights across leads, quotes, jobs and invoices.
        </p>
      </div>

      <InsightsCard />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card
              className=" border-border hover:border-primary cursor-pointer transition-colors h-full"
              data-testid={`report-card-${c.href.split("/").pop()}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="uppercase tracking-tight text-lg">{c.title}</CardTitle>
                  <c.Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardDescription className="text-sm">{c.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InsightsCard() {
  const { data, isLoading } = useGetReportInsights();
  if (isLoading || !data || data.items.length === 0) return null;
  return (
    <Card className="rounded-none border-primary/40 bg-primary/5" data-testid="card-insights">
      <CardHeader>
        <CardTitle className="uppercase tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Insights
        </CardTitle>
        <CardDescription>
          Biggest movers compared with the previous period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.items.map((it, i) => (
            <div key={i} className="border border-border bg-background p-3" data-testid={`insight-${i}`}>
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
                {it.direction === "up" && <TrendingUp className="h-4 w-4 text-green-600" />}
                {it.direction === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
                {it.direction === "flat" && <Minus className="h-4 w-4 text-muted-foreground" />}
                <span>{it.title}</span>
                <span
                  className={`ml-auto font-mono text-xs ${
                    it.direction === "up"
                      ? "text-green-600"
                      : it.direction === "down"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {it.changePct > 0 ? "+" : ""}
                  {it.changePct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{it.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
