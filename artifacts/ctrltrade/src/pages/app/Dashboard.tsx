import { useGetOnboarding, useGetExpiryAttention, useGetLeadSourceRoi, useGetInboxUnreadCount, useListInboxThreads, useGetIndustryTour, useDismissIndustryTour, useGetFinancialSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { CheckCircle2, Circle, AlertTriangle, Clock, Target, Inbox, X, Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus, BadgePoundSterling, ReceiptText, TriangleAlert, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function AppDashboard() {
  const { data: onboarding, isLoading: isLoadingOnboarding } = useGetOnboarding();

  if (isLoadingOnboarding) {
    return <div className="space-y-6"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>

      <FinancialSummaryCard />

      <IndustryTourBanner />

      <AttentionRequiredCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <InboxTile />
        <LeadSourceRoiCard />
      </div>

      {onboarding && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Onboarding Protocol</CardTitle>
            <CardDescription>Complete these steps to fully activate your tenant workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm font-bold font-mono">
                <span>{onboarding.percentComplete}% Complete</span>
              </div>
              <Progress value={onboarding.percentComplete} className="h-2 bg-muted [&>div]:bg-primary" />
            </div>
            <div className="space-y-4">
              {onboarding.items.map((item) => (
                <div key={item.key} className="flex items-start gap-4 p-4 border border-border bg-background">
                  {item.complete ? (
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-bold ${item.complete ? "line-through text-muted-foreground" : ""}`}>{item.label}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                  {!item.complete && item.href && (
                    <Link href={item.href}>
                      <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold shrink-0">
                        Action
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fmtGbp(pence: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function MoMBadge({ thisMonth, lastMonth }: { thisMonth: number; lastMonth: number }) {
  if (lastMonth === 0 && thisMonth === 0) return null;
  if (lastMonth === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-green-500 bg-green-500/10 px-1.5 py-0.5">
        <TrendingUp className="h-3 w-3" /> NEW
      </span>
    );
  }
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-muted-foreground bg-muted px-1.5 py-0.5">
        <Minus className="h-3 w-3" /> 0% vs last mo
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono px-1.5 py-0.5 ${up ? "text-green-500 bg-green-500/10" : "text-destructive bg-destructive/10"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}% vs last mo
    </span>
  );
}

function FinancialSummaryCard() {
  const { data, isLoading } = useGetFinancialSummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const currency = data.currency ?? "gbp";
  const fmt = (p: number) => fmtGbp(p, currency);

  const tiles = [
    {
      label: "Revenue This Month",
      icon: BadgePoundSterling,
      value: fmt(data.revenueThisMonthPence),
      sub: <MoMBadge thisMonth={data.revenueThisMonthPence} lastMonth={data.revenueLastMonthPence} />,
      subText: data.revenueLastMonthPence > 0 ? `${fmt(data.revenueLastMonthPence)} last mo` : "No revenue last month",
      accent: "primary" as const,
      href: "/app/invoices",
      testId: "kpi-revenue",
    },
    {
      label: "Outstanding",
      icon: ReceiptText,
      value: fmt(data.outstandingPence),
      sub: null,
      subText: `${data.outstandingCount} invoice${data.outstandingCount === 1 ? "" : "s"} awaiting payment`,
      accent: "neutral" as const,
      href: "/app/invoices",
      testId: "kpi-outstanding",
    },
    {
      label: "Overdue",
      icon: TriangleAlert,
      value: fmt(data.overduePence),
      sub: null,
      subText: `${data.overdueCount} invoice${data.overdueCount === 1 ? "" : "s"} past due`,
      accent: data.overdueCount > 0 ? ("destructive" as const) : ("neutral" as const),
      href: "/app/invoices",
      testId: "kpi-overdue",
    },
    {
      label: "Quote Pipeline",
      icon: Target,
      value: fmt(data.pipelinePence),
      sub: null,
      subText: `${data.pipelineCount} open quote${data.pipelineCount === 1 ? "" : "s"}`,
      accent: "neutral" as const,
      href: "/app/quotes",
      testId: "kpi-pipeline",
    },
    {
      label: "Jobs This Month",
      icon: Briefcase,
      value: String(data.jobsThisMonth),
      sub: null,
      subText: `${data.jobsCompletedThisMonth} completed${data.avgJobValuePence > 0 ? ` · avg ${fmt(data.avgJobValuePence)}` : ""}`,
      accent: "neutral" as const,
      href: "/app/jobs",
      testId: "kpi-jobs",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="financial-summary">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const isDestructive = tile.accent === "destructive";
        const isPrimary = tile.accent === "primary";
        return (
          <Link key={tile.testId} href={tile.href}>
            <div
              data-testid={tile.testId}
              className={`relative flex flex-col gap-2 p-4 border cursor-pointer hover:bg-muted/40 transition-colors h-full ${
                isDestructive
                  ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                  : isPrimary
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold font-mono uppercase tracking-wide ${isDestructive ? "text-destructive" : isPrimary ? "text-primary" : "text-muted-foreground"}`}>
                  {tile.label}
                </span>
                <Icon className={`h-4 w-4 shrink-0 ${isDestructive ? "text-destructive" : isPrimary ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className={`text-2xl font-bold font-mono leading-none ${isDestructive ? "text-destructive" : isPrimary ? "text-primary" : ""}`}>
                {tile.value}
              </div>
              <div className="space-y-1 mt-auto">
                {tile.sub}
                <p className="text-[11px] text-muted-foreground leading-snug">{tile.subText}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function IndustryTourBanner() {
  const { data: tour, isLoading } = useGetIndustryTour();
  const dismiss = useDismissIndustryTour();
  const queryClient = useQueryClient();

  if (isLoading || !tour || tour.dismissed) return null;

  const handleDismiss = () => {
    dismiss.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/v1/onboarding/industry-tour"], (old: typeof tour) => old ? { ...old, dismissed: true } : old);
      },
    });
  };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm" data-testid="industry-tour-banner">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-lg">
                Your workspace is ready
                {tour.industryName && (
                  <span className="ml-2 text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">
                    {tour.industryName}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                We've pre-populated your workspace with industry-specific content. Here's where to start.
              </CardDescription>
              {tour.enabledModules.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tour.enabledModules.map((mod: string) => (
                    <span key={mod} className="text-[10px] font-bold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 font-mono">
                      {mod}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 w-8 p-0 rounded-xl hover:bg-primary/10"
            onClick={handleDismiss}
            disabled={dismiss.isPending}
            aria-label="Dismiss onboarding tour"
            data-testid="industry-tour-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tour.quickActions.map((action: { key: string; label: string; description: string; href: string }) => (
            <Link key={action.key} href={action.href}>
              <div
                className="flex items-start justify-between gap-3 p-3 border border-border bg-background hover:bg-muted/40 cursor-pointer group"
                data-testid={`industry-tour-action-${action.key}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight">{action.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{action.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InboxTile() {
  const { data: unread } = useGetInboxUnreadCount({ query: { refetchInterval: 30000 } as any });
  const { data: threadsData, isLoading } = useListInboxThreads({ query: { refetchInterval: 30000 } as any });
  const threads = (threadsData?.threads ?? []).slice(0, 5);
  if (isLoading && threads.length === 0) return null;
  const unreadCount = unread?.count ?? 0;
  return (
    <Card className="border-border shadow-sm" data-testid="card-inbox">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Inbox
            </CardTitle>
            <CardDescription>
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : "All caught up."}
            </CardDescription>
          </div>
          <Link href="/app/inbox">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold" data-testid="link-inbox-open">Open inbox</Button>
          </Link>
        </div>
      </CardHeader>
      {threads.length > 0 && (
        <CardContent className="pt-0">
          <div className="divide-y divide-border border border-border">
            {threads.map((t: any) => (
              <Link key={t.id} href="/app/inbox">
                <div className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 cursor-pointer" data-testid={`row-inbox-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold truncate">
                      <span className="text-xs text-muted-foreground">{t.channel}</span>
                      <span className="truncate">{t.customerName ?? t.customerEmail ?? "(unknown)"}</span>
                      {t.unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{t.lastMessagePreview ?? t.subject ?? ""}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 font-mono">
                    {new Date(t.lastMessageAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function LeadSourceRoiCard() {
  const { data, isLoading } = useGetLeadSourceRoi();
  if (isLoading || !data) return null;
  if (data.totalLeads === 0) return null;
  const fmt = (p: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: data.currency, maximumFractionDigits: 0 }).format(p / 100);
  return (
    <Card className="border-border shadow-sm" data-testid="card-lead-source-roi">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" /> Lead Source ROI
            </CardTitle>
            <CardDescription>
              {data.totalLeads} lead{data.totalLeads === 1 ? "" : "s"} · {data.wonLeads} won · {fmt(data.wonValuePence)} closed · {fmt(data.pipelineValuePence)} in pipeline
            </CardDescription>
          </div>
          <Link href="/app/leads">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">All leads</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border border-border bg-background">
          {data.rows.map((r) => (
            <div key={r.source} className="grid grid-cols-12 gap-2 p-3 text-sm items-center">
              <div className="col-span-3 font-mono font-bold">{r.source}</div>
              <div className="col-span-2 text-muted-foreground">{r.totalLeads} leads</div>
              <div className="col-span-2 text-muted-foreground">{r.wonLeads} won</div>
              <div className="col-span-2 font-mono">{r.conversionPct}%</div>
              <div className="col-span-3 text-right font-mono font-bold">{fmt(r.wonValuePence)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionRequiredCard() {
  const { data, isLoading } = useGetExpiryAttention();
  if (isLoading || !data) return null;
  if (data.expiredCount === 0 && data.expiringCount === 0) return null;
  return (
    <Card className="border-destructive/40 shadow-sm bg-destructive/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Attention Required
            </CardTitle>
            <CardDescription>
              Certificates, MOT, tax and service items expiring within {data.windowDays} days — and any already expired.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="px-2 py-1 text-xs font-bold bg-destructive/20 text-destructive font-mono">
              {data.expiredCount} expired
            </div>
            <div className="px-2 py-1 text-xs font-bold bg-primary/20 text-primary font-mono">
              {data.expiringCount} expiring
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border border-border bg-background">
          {data.items.slice(0, 6).map((item) => (
            <Link key={`${item.kind}-${item.recordId}`} href={item.href}>
              <div className="flex items-center justify-between gap-4 p-3 hover:bg-muted/40 cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className={`h-4 w-4 shrink-0 ${item.expired ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{item.label}</div>
                    {item.reference && (
                      <div className="text-xs text-muted-foreground truncate font-mono">{item.reference}</div>
                    )}
                  </div>
                </div>
                <div className="text-xs font-mono shrink-0 text-right">
                  {item.expired ? (
                    <span className="text-destructive font-bold">Expired {Math.abs(item.daysUntil)}d ago</span>
                  ) : (
                    <span className="text-foreground">Due in {item.daysUntil}d</span>
                  )}
                  <div className="text-muted-foreground">{new Date(item.expiresAt).toLocaleDateString()}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {data.items.length > 6 && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            + {data.items.length - 6} more — review on Compliance and Fleet.
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Link href="/app/compliance">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">Compliance</Button>
        </Link>
        <Link href="/app/fleet">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">Fleet</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
