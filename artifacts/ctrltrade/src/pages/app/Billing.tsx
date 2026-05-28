import { useEffect, useState } from "react";
import {
  useGetBillingOverview,
  useListBillingInvoices,
  useSyncTenantFromStripe,
  useCreateBillingPaymentMethodSetup,
} from "@workspace/api-client-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CreditCard, Receipt, Download, ExternalLink, Calendar } from "lucide-react";

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
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } =
    useListBillingInvoices();
  const sync = useSyncTenantFromStripe();
  const createSetupIntent = useCreateBillingPaymentMethodSetup();
  const { toast } = useToast();

  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [pmClientSecret, setPmClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStripePromise(import.meta.env.BASE_URL ?? "/").then((s) => {
      if (cancelled) return;
      setStripePromise(s ? Promise.resolve(s) : null);
    });
    return () => {
      cancelled = true;
    };
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
    toast({
      title: "Payment method saved",
      description: "Syncing with Stripe…",
    });
    sync.mutate(undefined, {
      onSettled: () => {
        refetchOverview();
      },
    });
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
        <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter">Billing & Subscription</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={sync.isPending}
          className="rounded-none uppercase tracking-wider text-xs font-bold"
          data-testid="button-billing-sync"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} /> Sync
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className=" border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="uppercase tracking-tight">Current Plan</CardTitle>
                  <CardDescription>Your active resource allocation.</CardDescription>
                </div>
                <div
                  className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${
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
                      <div className="font-bold uppercase text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} × {formatMoney(item.unitAmount, item.currency)} / mo
                      </div>
                    </div>
                    <div className="font-mono font-bold">{formatMoney(item.subtotal, item.currency)}</div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4">
                  <div className="font-bold uppercase text-lg">Monthly Total</div>
                  <div
                    className="font-mono font-bold text-2xl text-primary"
                    data-testid="text-billing-total"
                  >
                    {formatMoney(monthlyTotal, currency)}
                  </div>
                </div>

                {(subscription.trialEndsAt || subscription.currentPeriodEnd) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    {subscription.trialEndsAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">
                            Trial ends
                          </div>
                          <div
                            className="text-sm font-mono font-bold"
                            data-testid="text-billing-trial-end"
                          >
                            {formatDate(subscription.trialEndsAt)}
                          </div>
                        </div>
                      </div>
                    )}
                    {subscription.currentPeriodEnd && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">
                            {subscription.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
                          </div>
                          <div
                            className="text-sm font-mono font-bold"
                            data-testid="text-billing-period-end"
                          >
                            {formatDate(subscription.currentPeriodEnd)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className=" border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight flex items-center gap-2">
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
                        <div className="font-bold text-sm font-mono truncate">
                          {inv.number || inv.id}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(inv.created)}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            STATUS_STYLES[inv.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </span>
                        <div className="font-mono font-bold text-sm w-24 text-right">
                          {formatMoney(inv.total, inv.currency)}
                        </div>
                        <div className="flex items-center gap-1">
                          {inv.hostedInvoiceUrl && (
                            <a
                              href={inv.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted"
                              title="View invoice"
                              data-testid={`link-invoice-view-${inv.id}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {inv.invoicePdf && (
                            <a
                              href={inv.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted"
                              title="Download PDF"
                              data-testid={`link-invoice-pdf-${inv.id}`}
                            >
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
        </div>

        <div className="space-y-8">
          <Card className=" border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Next Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingInvoice ? (
                <div className="space-y-2">
                  <div
                    className="font-mono font-bold text-2xl text-primary"
                    data-testid="text-upcoming-amount"
                  >
                    {formatMoney(upcomingInvoice.amountDue, upcomingInvoice.currency)}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Due{" "}
                    <span data-testid="text-upcoming-date">
                      {formatDate(upcomingInvoice.nextPaymentAttempt ?? upcomingInvoice.periodEnd)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">No upcoming invoice scheduled.</p>
              )}
            </CardContent>
          </Card>

          <Card className=" border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethod ? (
                <div
                  className="p-4 border border-border bg-card flex items-center gap-4"
                  data-testid="card-payment-method"
                >
                  <div className="h-10 w-14 bg-muted flex items-center justify-center border border-border">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold uppercase text-sm">
                      {paymentMethod.brand} •••• {paymentMethod.last4}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Expires {String(paymentMethod.expMonth).padStart(2, "0")}/
                      {String(paymentMethod.expYear).slice(-2)}
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
                className="w-full uppercase tracking-wider font-bold text-xs"
                data-testid="button-update-payment-method"
              >
                {createSetupIntent.isPending
                  ? "Preparing…"
                  : paymentMethod
                    ? "Update Payment Method"
                    : "Add Payment Method"}
              </Button>
              {!stripePromise && (
                <p className="text-xs text-muted-foreground font-mono">
                  Stripe is not connected in this environment.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={pmDialogOpen}
        onOpenChange={(open) => {
          setPmDialogOpen(open);
          if (!open) setPmClientSecret(null);
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight">Update Payment Method</DialogTitle>
            <DialogDescription>
              Saved cards become the default for future invoices.
            </DialogDescription>
          </DialogHeader>
          {stripePromise && pmClientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: pmClientSecret,
                appearance: { theme: "flat", variables: { colorPrimary: "#f97316", borderRadius: "0px" } },
              }}
            >
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
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full font-bold uppercase tracking-wider"
        data-testid="button-confirm-update-payment-method"
      >
        {loading ? "Saving…" : "Save Card"}
      </Button>
    </form>
  );
}
