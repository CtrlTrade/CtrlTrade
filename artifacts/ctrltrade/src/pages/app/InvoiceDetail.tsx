import { useParams, Link } from "wouter";
import {
  useGetInvoice,
  useSendInvoice,
  useVoidInvoice,
  getGetInvoiceQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Ban, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

export function AppInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetInvoice(id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
  };

  const send = useSendInvoice({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Invoice sent" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const voidInv = useVoidInvoice({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Invoice voided" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Invoice not found.</p>;

  const canSend = data.status === "draft";
  const canVoid = data.status !== "paid" && data.status !== "void";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/invoices" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">Customer: <span className="font-medium">{data.customerName}</span></p>
        </div>
        <Badge variant={STATUS_VARIANT[data.status] ?? "outline"} className="uppercase rounded-none" data-testid="badge-invoice-status">{data.status}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send.mutate({ invoiceId: id })} disabled={!canSend || send.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-send-invoice">
          <Send className="h-4 w-4 mr-2" /> Send & request payment
        </Button>
        {data.paymentLinkUrl && (
          <a href={data.paymentLinkUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-payment-link">
              <ExternalLink className="h-4 w-4 mr-2" /> Open payment link
            </Button>
          </a>
        )}
        <Button onClick={() => { if (confirm("Void this invoice?")) voidInv.mutate({ invoiceId: id }); }}
          disabled={!canVoid || voidInv.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-void-invoice">
          <Ban className="h-4 w-4 mr-2" /> Void
        </Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader><CardTitle className="uppercase tracking-tight">Line items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
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
                <TableCell colSpan={3} className="text-right uppercase text-muted-foreground">Subtotal</TableCell>
                <TableCell className="text-right font-mono">{formatGBP(data.subtotalPence)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right uppercase text-muted-foreground">VAT ({data.vatRatePct}%)</TableCell>
                <TableCell className="text-right font-mono">{formatGBP(data.taxPence)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold uppercase">Total</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatGBP(data.totalPence)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {data.notes && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{data.notes}</p>}
        </CardContent>
      </Card>

      {data.payments.length > 0 && (
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader><CardTitle className="uppercase tracking-tight">Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.receivedAt).toLocaleString("en-GB")}</TableCell>
                    <TableCell className="uppercase text-xs">{p.provider}</TableCell>
                    <TableCell className="uppercase text-xs">{p.status}</TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(p.amountPence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
