import { useGetSubscription, useGetPricing, useSyncTenantFromStripe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CreditCard, Receipt } from "lucide-react";

export function AppBilling() {
  const { data: subscription, isLoading: subLoading, refetch } = useGetSubscription();
  const { data: pricing, isLoading: pricingLoading } = useGetPricing();
  const sync = useSyncTenantFromStripe();
  const { toast } = useToast();

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Synced with Stripe", description: "Subscription details updated." });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Sync failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (subLoading || pricingLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  }

  if (!subscription || !pricing) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Billing & Subscription</h1>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending} className="rounded-none uppercase tracking-wider text-xs font-bold" data-testid="button-billing-sync">
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? 'animate-spin' : ''}`} /> Sync
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="uppercase tracking-tight">Current Plan</CardTitle>
                  <CardDescription>Your active resource allocation.</CardDescription>
                </div>
                <div className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${
                  subscription.status === 'trial' ? 'bg-primary/20 text-primary' : 
                  subscription.status === 'active' ? 'bg-green-500/20 text-green-500' : 
                  'bg-destructive/20 text-destructive'
                }`}>
                  {subscription.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <div>
                    <div className="font-bold uppercase text-sm">Control Seats</div>
                    <div className="text-xs text-muted-foreground">{subscription.controlSeats} × £{pricing.controlSeat.amount} / mo</div>
                  </div>
                  <div className="font-mono font-bold">£{subscription.controlSeats * pricing.controlSeat.amount}</div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <div>
                    <div className="font-bold uppercase text-sm">Field Seats</div>
                    <div className="text-xs text-muted-foreground">{subscription.fieldSeats} × £{pricing.fieldSeat.amount} / mo</div>
                  </div>
                  <div className="font-mono font-bold">£{subscription.fieldSeats * pricing.fieldSeat.amount}</div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <div>
                    <div className="font-bold uppercase text-sm">POS Tills</div>
                    <div className="text-xs text-muted-foreground">{subscription.tills} × £{pricing.till.amount} / mo</div>
                  </div>
                  <div className="font-mono font-bold">£{subscription.tills * pricing.till.amount}</div>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <div className="font-bold uppercase text-lg">Monthly Total</div>
                  <div className="font-mono font-bold text-2xl text-primary" data-testid="text-billing-total">£{subscription.monthlyTotal}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight flex items-center gap-2"><Receipt className="h-5 w-5"/> Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border border-dashed border-border bg-muted/30">
                <p className="text-muted-foreground font-mono text-sm">No recent invoices available.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight flex items-center gap-2"><CreditCard className="h-5 w-5"/> Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-border bg-card flex items-center gap-4">
                <div className="h-10 w-14 bg-muted flex items-center justify-center border border-border">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-bold uppercase text-sm">Card on file</div>
                  <div className="text-xs text-muted-foreground font-mono">Managed via Stripe</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
