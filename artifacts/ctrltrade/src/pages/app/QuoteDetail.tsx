import { useParams, Link } from "wouter";
import {
  useGetQuote,
  useSendQuote,
  useAcceptQuote,
  useConvertQuoteToJob,
  getGetQuoteQueryKey,
  getListQuotesQueryKey,
  getListJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Check, ArrowRightCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function AppQuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetQuote(id);
  const qc = useQueryClient();
  const { toast } = useToast();
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

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Quote not found.</p>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/app/quotes" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">Customer: <span className="font-medium">{data.customerName}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="uppercase rounded-none" data-testid="badge-quote-status">{data.status}</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => send.mutate({ quoteId: id })} disabled={data.status === "converted" || send.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-send-quote">
          <Send className="h-4 w-4 mr-2" /> Send
        </Button>
        <Button onClick={() => accept.mutate({ quoteId: id })} disabled={data.status === "converted" || accept.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-accept-quote">
          <Check className="h-4 w-4 mr-2" /> Accept
        </Button>
        <Button onClick={() => convert.mutate({ quoteId: id, data: {} })} disabled={data.status === "converted" || convert.isPending}
          className="rounded-none uppercase tracking-wider font-bold" data-testid="button-convert-quote">
          <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to job
        </Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader><CardTitle className="uppercase tracking-tight">Line items</CardTitle></CardHeader>
        <CardContent>
          <Table>
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
          </Table>
          {data.notes && <p className="mt-4 text-sm text-muted-foreground">{data.notes}</p>}
          {data.convertedJobId && (
            <p className="mt-4 text-sm">Converted to job: <Link href={`/app/jobs/${data.convertedJobId}`} className="underline">{data.convertedJobId}</Link></p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
