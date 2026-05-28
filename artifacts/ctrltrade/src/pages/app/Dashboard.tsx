import { useGetOnboarding, useGetSubscription, useUpdateSubscriptionQuantities, useCancelTenant, useGetExpiryAttention, useGetLeadSourceRoi, useGetInboxUnreadCount, useListInboxThreads, useGetIndustryTour, useDismissIndustryTour } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { CheckCircle2, Circle, AlertTriangle, CreditCard, Users, ShoppingCart, Clock, Target, Inbox, X, Sparkles, ArrowRight } from "lucide-react";
import { UsageTile } from "@/components/UsageTile";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function AppDashboard() {
  const { data: onboarding, isLoading: isLoadingOnboarding } = useGetOnboarding();
  const { data: subscription, isLoading: isLoadingSub } = useGetSubscription();
  
  if (isLoadingOnboarding || isLoadingSub) {
    return <div className="space-y-6"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Command Center</h1>
      
      <IndustryTourBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <AttentionRequiredCard />
          <InboxTile />
          <LeadSourceRoiCard />
          <UsageTile />
          {onboarding && (
            <Card className=" border-border shadow-sm">
              <CardHeader>
                <CardTitle className="uppercase tracking-tight">Onboarding Protocol</CardTitle>
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
                        <h4 className={`font-bold ${item.complete ? 'line-through text-muted-foreground' : ''}`}>{item.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      </div>
                      {!item.complete && item.href && (
                        <Link href={item.href}>
                          <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold shrink-0">
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
        
        <div>
          {subscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>
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
              <CardTitle className="uppercase tracking-tight text-lg">
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
                    <span key={mod} className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border px-1.5 py-0.5 font-mono">
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
            className="shrink-0 h-8 w-8 p-0 rounded-none hover:bg-primary/10"
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
                  <div className="text-sm font-bold uppercase tracking-wide leading-tight">{action.label}</div>
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
    <Card className=" border-border shadow-sm" data-testid="card-inbox">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Inbox
            </CardTitle>
            <CardDescription>
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : "All caught up."}
            </CardDescription>
          </div>
          <Link href="/app/inbox">
            <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold" data-testid="link-inbox-open">Open inbox</Button>
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
                      <span className="uppercase tracking-wider text-xs text-muted-foreground">{t.channel}</span>
                      <span className="truncate">{t.customerName ?? t.customerEmail ?? "(unknown)"}</span>
                      {t.unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{t.lastMessagePreview ?? t.subject ?? ""}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 font-mono uppercase">
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
    <Card className=" border-border shadow-sm" data-testid="card-lead-source-roi">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2">
              <Target className="h-5 w-5" /> Lead Source ROI
            </CardTitle>
            <CardDescription>
              {data.totalLeads} lead{data.totalLeads === 1 ? "" : "s"} · {data.wonLeads} won · {fmt(data.wonValuePence)} closed · {fmt(data.pipelineValuePence)} in pipeline
            </CardDescription>
          </div>
          <Link href="/app/leads">
            <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold">All leads</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border border-border bg-background">
          {data.rows.map((r) => (
            <div key={r.source} className="grid grid-cols-12 gap-2 p-3 text-sm items-center">
              <div className="col-span-3 uppercase tracking-wider font-mono font-bold">{r.source}</div>
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
    <Card className="rounded-none border-destructive/40 shadow-sm bg-destructive/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Attention Required
            </CardTitle>
            <CardDescription>
              Certificates, MOT, tax and service items expiring within {data.windowDays} days — and any already expired.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-destructive/20 text-destructive font-mono">
              {data.expiredCount} expired
            </div>
            <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary font-mono">
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
          <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold">
            Compliance
          </Button>
        </Link>
        <Link href="/app/fleet">
          <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold">
            Fleet
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function SubscriptionCard({ subscription }: { subscription: any }) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  
  return (
    <>
      <Card className=" border-border shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="uppercase tracking-tight">Subscription</CardTitle>
            <div className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${
              subscription.status === 'trial' ? 'bg-primary/20 text-primary' : 
              subscription.status === 'active' ? 'bg-green-500/20 text-green-500' : 
              'bg-destructive/20 text-destructive'
            }`}>
              {subscription.status}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription.status === 'trial' && subscription.trialEndsAt && (
            <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary p-3 border border-primary/20">
              <AlertTriangle className="h-4 w-4" />
              <span>Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</span>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4"/> Control Seats</span>
              <span className="font-bold font-mono">{subscription.controlSeats}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4"/> Field Seats</span>
              <span className="font-bold font-mono">{subscription.fieldSeats}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><ShoppingCart className="h-4 w-4"/> POS Tills</span>
              <span className="font-bold font-mono">{subscription.tills}</span>
            </div>
          </div>
          
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-sm tracking-wider">Monthly Total</span>
              <span className="text-xl font-bold font-mono text-primary">£{subscription.monthlyTotal}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button className="w-full uppercase font-bold tracking-wider text-xs" onClick={() => setShowUpdate(true)}>
            Update Quantities
          </Button>
          <Button variant="ghost" className="w-full uppercase font-bold tracking-wider text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowCancel(true)}>
            Cancel Subscription
          </Button>
        </CardFooter>
      </Card>
      
      {showUpdate && <UpdateQuantitiesDialog subscription={subscription} open={showUpdate} onOpenChange={setShowUpdate} />}
      {showCancel && <CancelSubscriptionDialog open={showCancel} onOpenChange={setShowCancel} />}
    </>
  );
}

function UpdateQuantitiesDialog({ subscription, open, onOpenChange }: { subscription: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [controlSeats, setControlSeats] = useState(subscription.controlSeats);
  const [fieldSeats, setFieldSeats] = useState(subscription.fieldSeats);
  const [tills, setTills] = useState(subscription.tills);
  const update = useUpdateSubscriptionQuantities();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ data: { controlSeats, fieldSeats, tills } }, {
      onSuccess: () => {
        toast({ title: "Subscription updated", description: "Quantities have been updated successfully." });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">Update Quantities</DialogTitle>
          <DialogDescription>Adjust the number of seats and tills for your tenant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="controlSeats" className="col-span-2">Control Seats</Label>
            <Input id="controlSeats" type="number" min="1" value={controlSeats} onChange={e => setControlSeats(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fieldSeats" className="col-span-2">Field Seats</Label>
            <Input id="fieldSeats" type="number" min="0" value={fieldSeats} onChange={e => setFieldSeats(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tills" className="col-span-2">POS Tills</Label>
            <Input id="tills" type="number" min="0" value={tills} onChange={e => setTills(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending} className="rounded-none uppercase font-bold tracking-wider">
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubscriptionDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const cancel = useCancelTenant();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    
    cancel.mutate({ data: { reason } }, {
      onSuccess: () => {
        toast({ title: "Subscription cancelled", description: "Your subscription has been cancelled." });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-destructive sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight text-destructive">Cancel Subscription</DialogTitle>
          <DialogDescription>This action will terminate your subscription at the end of the current billing period.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCancel} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for cancellation</Label>
            <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Required" required className="rounded-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-none uppercase font-bold tracking-wider">
              Keep Subscription
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending} className="rounded-none uppercase font-bold tracking-wider">
              {cancel.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
