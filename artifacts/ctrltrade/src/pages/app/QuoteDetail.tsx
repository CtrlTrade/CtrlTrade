import { useParams, Link, useLocation } from "wouter";
import {
  useGetQuote,
  useSendQuote,
  useAcceptQuote,
  useConvertQuoteToJob,
  useGenerateInvoiceFromQuote,
  useGenerateDepositInvoiceFromQuote,
  getGetQuoteQueryKey,
  getListQuotesQueryKey,
  getListJobsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Check, ArrowRightCircle, Receipt, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TenantThread } from "@/components/TenantThread";
import { AiPanel } from "@/components/ai/AiPanel";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function AppQuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetQuote(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
  };
  const send = useSendQuote({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Quote sent" }); } } });
  const accept = useAcceptQuote({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Quote accepted" }); } } });
  const convert = useConvertQuoteToJob({
    mutation: {
      onSuccess: (job) => {
        invalidate();
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        toast({ title: `Job ${job.number} created` });
      },
    },
  });
  const generateInvoice = useGenerateInvoiceFromQuote({
    mutation: {
      onSuccess: (inv) => {
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: `Invoice ${inv.number} created` });
        setLocation(`/invoices/${inv.id}`);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const depositInvoice = useGenerateDepositInvoiceFromQuote({
    mutation: {
      onSuccess: (inv) => {
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: `Deposit invoice ${inv.number} created` });
        setLocation(`/invoices/${inv.id}`);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const canInvoice = data?.status === "accepted" || data?.status === "converted";
  const canDeposit = data?.status === "sent" || data?.status === "accepted" || data?.status === "converted";
  const requestDeposit = () => {
    const raw = window.prompt("Deposit percentage (1-100):", "25");
    if (!raw) return;
    const pct = parseInt(raw, 10);
    if (Number.isNaN(pct) || pct < 1 || pct > 100) {
      toast({ title: "Invalid percentage", variant: "destructive" });
      return;
    }
    depositInvoice.mutate({ quoteId: id, data: { depositPct: pct } });
  };

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Quote not found.</p>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/quotes" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>
      <div className="flex flex-wrap gap-y-3 justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">Customer: <span className="font-medium">{data.customerName}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="uppercase" data-testid="badge-quote-status">{data.status}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send.mutate({ quoteId: id })} disabled={data.status === "converted" || send.isPending}
          variant="outline" className="rounded-xl font-bold" data-testid="button-send-quote">
          <Send className="h-4 w-4 mr-2" /> Send
        </Button>
        <Button onClick={() => accept.mutate({ quoteId: id })} disabled={data.status === "converted" || accept.isPending}
          variant="outline" className="rounded-xl font-bold" data-testid="button-accept-quote">
          <Check className="h-4 w-4 mr-2" /> Accept
        </Button>
        <Button onClick={() => convert.mutate({ quoteId: id, data: {} })} disabled={data.status === "converted" || convert.isPending}
          className="rounded-xl font-bold" data-testid="button-convert-quote">
          <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to job
        </Button>
        {canDeposit && (
          <Button onClick={requestDeposit} disabled={depositInvoice.isPending}
            variant="outline" className="rounded-xl font-bold" data-testid="button-deposit-invoice">
            <Percent className="h-4 w-4 mr-2" /> Deposit invoice
          </Button>
        )}
        {canInvoice && (
          <Button onClick={() => generateInvoice.mutate({ quoteId: id })}
            disabled={generateInvoice.isPending}
            className="rounded-xl font-bold" data-testid="button-generate-invoice-quote">
            <Receipt className="h-4 w-4 mr-2" /> Generate invoice
          </Button>
        )}
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader><CardTitle className="">Line items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Subtotal</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatGBP(it.unitPricePence)}</TableCell>
                  <TableCell className="text-right font-mono">{formatGBP(it.quantity * it.unitPricePence)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold uppercase">Total</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatGBP(data.totalPence)}</TableCell>
              </TableRow>
            </TableBody>
          </Table></div>
          {data.notes && <p className="mt-4 text-sm text-muted-foreground">{data.notes}</p>}
          {data.convertedJobId && (
            <p className="mt-4 text-sm">Converted to job: <Link href={`/app/jobs/${data.convertedJobId}`} className="underline">{data.convertedJobId}</Link></p>
          )}
        </CardContent>
      </Card>

      <AiPanel
        title="CtrlAI — Quote Builder"
        description="Get AI suggestions for pricing, scope, or a covering note for this quote."
        buttonLabel="Generate Suggestions"
        endpoint="v1/ai/quote-builder"
        resultKey="suggestions"
        badgeLabel="AI"
        prompt={{
          quoteId: id,
          number: data.number,
          customerName: data.customerName,
          totalPence: data.totalPence,
          status: data.status,
          notes: data.notes,
          items: data.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPricePence: it.unitPricePence })),
        }}
      />

      <TenantThread subjectKind="quote" subjectId={id} />
    </div>
  );
}
