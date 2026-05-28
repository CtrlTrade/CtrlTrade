import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useGetPortalInvoice, usePayPortalInvoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function PortalInvoice() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, error } = useGetPortalInvoice(id);
  useEffect(() => {
    const e = error as { status?: number } | null;
    if (isError && e?.status === 401) setLocation(`/portal/${tenantSlug}`);
  }, [isError, error, setLocation, tenantSlug]);
  const { toast } = useToast();
  const pay = usePayPortalInvoice({
    mutation: {
      onSuccess: (resp) => {
        if (resp.url) {
          window.location.href = resp.url;
        } else {
          toast({
            title: "Card payment unavailable",
            description: "Please contact the company directly to pay this invoice.",
            variant: "destructive",
          });
        }
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Invoice not found.</p>;

  const itemsTotal = data.items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href={`/portal/${tenantSlug}/app`}
        className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{data.number}</h1>
          <p className="text-muted-foreground">
            {data.title}
            {data.isDeposit ? (
              <span className="ml-2 text-xs">(Deposit)</span>
            ) : null}
          </p>
        </div>
        <Badge className="uppercase rounded-xl">{data.status}</Badge>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.items.map((i) => (
            <div key={i.id} className="flex justify-between border-b border-border pb-2">
              <span>
                {i.description}{" "}
                <span className="text-muted-foreground">× {i.quantity}</span>
              </span>
              <span className="font-mono">{formatGBP(i.quantity * i.unitPricePence)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <span>Subtotal</span>
            <span className="font-mono">{formatGBP(itemsTotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span>Total</span>
            <span className="font-mono">{formatGBP(data.totalPence)}</span>
          </div>
          {data.dueAt ? (
            <p className="text-xs text-muted-foreground">
              Due {new Date(data.dueAt).toLocaleDateString("en-GB")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data.status !== "paid" && data.status !== "void" ? (
        <Button
          onClick={() => pay.mutate({ invoiceId: id })}
          disabled={pay.isPending}
          className="rounded-xl font-bold"
          data-testid="button-portal-pay-invoice"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {pay.isPending ? "Preparing…" : "Pay by card"}
        </Button>
      ) : data.status === "paid" ? (
        <Card className=" border-border shadow-sm">
          <CardContent className="py-4 text-sm">
            Paid{data.paidAt ? ` on ${new Date(data.paidAt).toLocaleString("en-GB")}` : ""}.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
