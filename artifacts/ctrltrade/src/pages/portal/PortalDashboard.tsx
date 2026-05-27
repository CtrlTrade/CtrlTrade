import { Link, useParams, useLocation } from "wouter";
import { useGetPortalDashboard, useGetPortalSession } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function PortalDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessLoading, isError: sessError } = useGetPortalSession({
    query: { retry: false, queryKey: ["portal-session"] },
  });
  const { data, isLoading } = useGetPortalDashboard({
    query: { enabled: !!session, queryKey: ["portal-dashboard"] },
  });

  useEffect(() => {
    if (!sessLoading && sessError) setLocation(`/portal/${tenantSlug}`);
  }, [sessLoading, sessError, setLocation, tenantSlug]);

  if (sessLoading || isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Your account</h1>
        <Link href={`/portal/${tenantSlug}/refer`} className="text-xs uppercase tracking-wider font-bold underline" data-testid="link-portal-refer">Refer a friend →</Link>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes shared yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.quotes.map((q) => (
                <li key={q.id} className="py-3 flex items-center justify-between text-sm">
                  <Link
                    href={`/portal/${tenantSlug}/quotes/${q.id}`}
                    className="flex-1 hover:underline"
                    data-testid={`link-portal-quote-${q.id}`}
                  >
                    <div className="font-mono text-xs text-muted-foreground">{q.number}</div>
                    <div className="font-medium">{q.title}</div>
                  </Link>
                  <span className="font-mono mr-4">{formatGBP(q.totalPence)}</span>
                  <Badge className="uppercase rounded-none">{q.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active jobs.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.jobs.map((j) => (
                <li key={j.id} className="py-3 flex items-center justify-between text-sm">
                  <Link
                    href={`/portal/${tenantSlug}/jobs/${j.id}`}
                    className="flex-1 hover:underline"
                    data-testid={`link-portal-job-${j.id}`}
                  >
                    <div className="font-mono text-xs text-muted-foreground">{j.number}</div>
                    <div className="font-medium">{j.title}</div>
                    {j.scheduledStart ? (
                      <div className="text-xs text-muted-foreground">
                        {new Date(j.scheduledStart).toLocaleString("en-GB")}
                      </div>
                    ) : null}
                  </Link>
                  <Badge className="uppercase rounded-none">{j.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.invoices.map((i) => (
                <li key={i.id} className="py-3 flex items-center justify-between text-sm">
                  <Link
                    href={`/portal/${tenantSlug}/invoices/${i.id}`}
                    className="flex-1 hover:underline"
                    data-testid={`link-portal-invoice-${i.id}`}
                  >
                    <div className="font-mono text-xs text-muted-foreground">{i.number}</div>
                    <div className="font-medium">
                      {i.title} {i.isDeposit ? <span className="text-xs uppercase text-muted-foreground">(Deposit)</span> : null}
                    </div>
                  </Link>
                  <span className="font-mono mr-4">{formatGBP(i.totalPence)}</span>
                  <Badge className="uppercase rounded-none">{i.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
