import { useEffect, useState } from "react";
import {
  useGetBillingOverview,
  useListBillingInvoices,
  useSyncTenantFromStripe,
  useCreateBillingPaymentMethodSetup,
  useUpdateSubscriptionQuantities,
  useCancelTenant,
} from "@workspace/api-client-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as DialogFoot } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CreditCard, Receipt, Download, ExternalLink, Calendar, Users, ShoppingCart, AlertTriangle, Activity } from "lucide-react";
import { UsageTile } from "@/components/UsageTile";

let stripePromiseCache: Promise<Stripe | null> | null = null;
async function loadStripePromise(baseUrl: string): Promise<Stripe | null> {
  if (stripePromiseCache) return stripePromiseCache;
  stripePromiseCache = (async () => {
    const resp = await fetch(`${baseUrl}api/v1/stripe/publishable-key`, { credentials: "include" });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { publishableKey?: string };
    if (!data.publishableKey) return null;
    return loadStripe(data.publishableKey);
  })();
  return stripePromiseCache;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-500/20 text-green-500",
  open: "bg-primary/20 text-primary",
  draft: "bg-muted text-muted-foreground",
  uncollectible: "bg-destructive/20 text-destructive",
  void: "bg-muted text-muted-foreground",
};

export function AppBilling() {
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useGetBillingOverview();
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useListBillingInvoices();
  const sync = useSyncTenantFromStripe();
  const createSetupIntent = useCreateBillingPaymentMethodSetup();
  const { toast } = useToast();

  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [pmClientSecret, setPmClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStripePromise(import.meta.env.BASE_URL ?? "/").then((s) => {
      if (cancelled) return;
      setStripePromise(s ? Promise.resolve(s) : null);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Synced with Stripe", description: "Subscription details updated." });
        refetchOverview();
        refetchInvoices();
      },
      onError: (err: any) => {
        toast({ title: "Sync failed", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleOpenUpdatePm = async () => {
    try {
      const intent = await createSetupIntent.mutateAsync();
      setPmClientSecret(intent.clientSecret);
      setPmDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Couldn't start update", description: err.message, variant: "destructive" });
    }
  };

  const handlePmSuccess = () => {
    setPmDialogOpen(false);
    setPmClientSecret(null);
    toast({ title: "Payment method saved", description: "Syncing with Stripe…" });
    sync.mutate(undefined, { onSettled: () => { refetchOverview(); } });
  };

  if (overviewLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (!overview) return null;

  const { subscription, planItems, currency, monthlyTotal, paymentMethod, upcomingInvoice } = overview;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Billing & Subscription</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={sync.isPending}
          className="rounded-xl text-xs font-bold"
          data-testid="button-billing-sync"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} /> Sync
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">

          {/* ── Current Plan ────────────────────────────────────── */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your active resource allocation.</CardDescription>
                </div>
                <div
                  className={`px-2 py-1 text-xs font-bold ${
                    subscription.status === "trial"
                      ? "bg-primary/20 text-primary"
                      : subscription.status === "active"
                        ? "bg-green-500/20 text-green-500"
                        : "bg-destructive/20 text-destructive"
                  }`}
                  data-testid="text-billing-status"
                >
                  {subscription.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {planItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex justify-between items-center py-2 border-b border-border/50"
                    data-testid={`row-plan-${item.key}`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} × {formatMoney(item.unitAmount, item.currency)} / mo
                      </div>
                    </div>
                    <div className="font-mono font-bold">{formatMoney(item.subtotal, item.currency)}</div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4">
                  <div className="font-semibold text-lg">Monthly Total</div>
                  <div className="font-mono font-bold text-2xl text-primary" data-testid="text-billing-total">
                    {formatMoney(monthlyTotal, currency)}
                  </div>
                </div>

                {(subscription.trialEndsAt || subscription.currentPeriodEnd) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    {subscription.trialEndsAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">Trial ends</div>
                          <div className="text-sm font-mono font-bold" data-testid="text-billing-trial-end">
                            {formatDate(subscription.trialEndsAt)}
                          </div>
                        </div>
                      </div>
                    )}
                    {subscription.currentPeriodEnd && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {subscription.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
                          </div>
                          <div className="text-sm font-mono font-bold" data-testid="text-billing-period-end">
                            {formatDate(subscription.currentPeriodEnd)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button className="w-full font-bold text-xs" onClick={() => setShowUpdate(true)}>
                Update Quantities
              </Button>
              <Button
                variant="ghost"
                className="w-full font-bold text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancel(true)}
              >
                Cancel Subscription
              </Button>
            </CardFooter>
          </Card>

          {/* ── Invoices ────────────────────────────────────────── */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Invoices
              </CardTitle>
              <CardDescription>Past invoices from Stripe.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <Skeleton className="h-32" />
              ) : !invoices || invoices.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border bg-muted/30">
                  <p className="text-muted-foreground font-mono text-sm">No invoices yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-3"
                      data-testid={`row-invoice-${inv.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm font-mono truncate">{inv.number || inv.id}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(inv.created)}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                          {inv.status}
                        </span>
                        <div className="font-mono font-bold text-sm w-24 text-right">
                          {formatMoney(inv.total, inv.currency)}
                        </div>
                        <div className="flex items-center gap-1">
                          {inv.hostedInvoiceUrl && (
                            <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted" title="View invoice" data-testid={`link-invoice-view-${inv.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {inv.invoicePdf && (
                            <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted" title="Download PDF" data-testid={`link-invoice-pdf-${inv.id}`}>
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Usage ───────────────────────────────────────────── */}
          <UsageTile />
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div className="space-y-8">

          {/* Seat / till summary */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Allocation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Control Seats</span>
                <span className="font-bold font-mono">{subscription.controlSeats}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Field Seats</span>
                <span className="font-bold font-mono">{subscription.fieldSeats}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><ShoppingCart className="h-4 w-4" /> POS Tills</span>
                <span className="font-bold font-mono">{subscription.tills}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next invoice */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Next Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingInvoice ? (
                <div className="space-y-2">
                  <div className="font-mono font-bold text-2xl text-primary" data-testid="text-upcoming-amount">
                    {formatMoney(upcomingInvoice.amountDue, upcomingInvoice.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Due <span data-testid="text-upcoming-date">{formatDate(upcomingInvoice.nextPaymentAttempt ?? upcomingInvoice.periodEnd)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">No upcoming invoice scheduled.</p>
              )}
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethod ? (
                <div className="p-4 border border-border bg-card flex items-center gap-4" data-testid="card-payment-method">
                  <div className="h-10 w-14 bg-muted flex items-center justify-center border border-border">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{paymentMethod.brand} •••• {paymentMethod.last4}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{String(paymentMethod.expYear).slice(-2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground font-mono">No card on file.</p>
                </div>
              )}
              <Button
                onClick={handleOpenUpdatePm}
                disabled={createSetupIntent.isPending || !stripePromise}
                className="w-full font-bold text-xs"
                data-testid="button-update-payment-method"
              >
                {createSetupIntent.isPending ? "Preparing…" : paymentMethod ? "Update Payment Method" : "Add Payment Method"}
              </Button>
              {!stripePromise && (
                <p className="text-xs text-muted-foreground font-mono">Stripe is not connected in this environment.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Update Quantities dialog ─────────────────────────── */}
      {showUpdate && (
        <UpdateQuantitiesDialog subscription={subscription} open={showUpdate} onOpenChange={setShowUpdate} />
      )}

      {/* ── Cancel Subscription dialog ───────────────────────── */}
      {showCancel && (
        <CancelSubscriptionDialog open={showCancel} onOpenChange={setShowCancel} />
      )}

      {/* ── Update payment method dialog ─────────────────────── */}
      <Dialog open={pmDialogOpen} onOpenChange={(open) => { setPmDialogOpen(open); if (!open) setPmClientSecret(null); }}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Update Payment Method</DialogTitle>
            <DialogDescription>Saved cards become the default for future invoices.</DialogDescription>
          </DialogHeader>
          {stripePromise && pmClientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret: pmClientSecret, appearance: { theme: "flat", variables: { colorPrimary: "#f97316", borderRadius: "0px" } } }}>
              <UpdatePaymentMethodForm onSuccess={handlePmSuccess} />
            </Elements>
          ) : (
            <Skeleton className="h-40" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UpdateQuantitiesDialog({
  subscription,
  open,
  onOpenChange,
}: {
  subscription: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [controlSeats, setControlSeats] = useState<number>(subscription.controlSeats);
  const [fieldSeats, setFieldSeats] = useState<number>(subscription.fieldSeats);
  const [tills, setTills] = useState<number>(subscription.tills);
  const update = useUpdateSubscriptionQuantities();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      { data: { controlSeats, fieldSeats, tills } },
      {
        onSuccess: () => {
          toast({ title: "Subscription updated", description: "Quantities have been updated successfully." });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Update failed", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Quantities</DialogTitle>
          <DialogDescription>Adjust the number of seats and tills for your tenant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="controlSeats" className="col-span-2 flex items-center gap-2"><Users className="h-4 w-4" /> Control Seats</Label>
            <Input id="controlSeats" type="number" min="1" value={controlSeats} onChange={(e) => setControlSeats(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fieldSeats" className="col-span-2 flex items-center gap-2"><Users className="h-4 w-4" /> Field Seats</Label>
            <Input id="fieldSeats" type="number" min="0" value={fieldSeats} onChange={(e) => setFieldSeats(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tills" className="col-span-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> POS Tills</Label>
            <Input id="tills" type="number" min="0" value={tills} onChange={(e) => setTills(parseInt(e.target.value))} className="col-span-2" />
          </div>
          <DialogFoot>
            <Button type="submit" disabled={update.isPending} className="rounded-xl font-semibold">
              {update.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubscriptionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelTenant();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    cancel.mutate(
      { data: { reason } },
      {
        onSuccess: () => {
          toast({ title: "Subscription cancelled", description: "Your subscription has been cancelled." });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-destructive sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Cancel Subscription
          </DialogTitle>
          <DialogDescription>
            This action will terminate your subscription at the end of the current billing period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCancel} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for cancellation</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" required />
          </div>
          <DialogFoot>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold">
              Keep Subscription
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending} className="rounded-xl font-semibold">
              {cancel.isPending ? "Cancelling…" : "Confirm Cancellation"}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpdatePaymentMethodForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't save card", description: error.message, variant: "destructive" });
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || loading} className="w-full font-bold" data-testid="button-confirm-update-payment-method">
        {loading ? "Saving…" : "Save Card"}
      </Button>
    </form>
  );
}
