import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPortalQuote,
  useAcceptPortalQuote,
  useDeclinePortalQuote,
  getGetPortalQuoteQueryKey,
  getGetPortalDashboardQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PortalThread } from "./PortalThread";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function PortalQuote() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, error } = useGetPortalQuote(id);
  useEffect(() => {
    const e = error as { status?: number } | null;
    if (isError && e?.status === 401) setLocation(`/portal/${tenantSlug}`);
  }, [isError, error, setLocation, tenantSlug]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [signatureName, setSignatureName] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const accept = useAcceptPortalQuote({
    mutation: {
      onSuccess: (resp) => {
        qc.invalidateQueries({ queryKey: getGetPortalQuoteQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetPortalDashboardQueryKey() });
        toast({ title: "Quote accepted" });
        if (resp.depositInvoiceId) {
          setLocation(`/portal/${tenantSlug}/invoices/${resp.depositInvoiceId}`);
        }
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const decline = useDeclinePortalQuote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPortalQuoteQueryKey(id) });
        toast({ title: "Quote declined" });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Quote not found.</p>;

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);
  const canRespond = data.status === "sent" || data.status === "accepted";
  const decided = data.status === "converted" || data.status === "declined";

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
          <h1 className="text-3xl font-bold uppercase tracking-tighter">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
        </div>
        <Badge className="uppercase rounded-none">{data.status}</Badge>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Line items</CardTitle>
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
          <div className="flex justify-between pt-2 font-bold">
            <span>Total (ex VAT)</span>
            <span className="font-mono">{formatGBP(subtotal)}</span>
          </div>
          {data.notes ? (
            <div className="pt-3 border-t border-border text-muted-foreground whitespace-pre-wrap">
              {data.notes}
            </div>
          ) : null}
          {(data.depositPct ?? 0) > 0 ? (
            <p className="text-xs text-muted-foreground pt-2">
              Acceptance creates a deposit invoice of {data.depositPct}% (
              {formatGBP(Math.round((subtotal * (data.depositPct ?? 0)) / 100))}, plus VAT).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canRespond ? (
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight">Accept this quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Type your full name to sign</Label>
              <Input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="rounded-none"
                data-testid="input-portal-signature"
              />
            </div>
            <div className="flex gap-3">
              <Button
                disabled={!signatureName.trim() || accept.isPending}
                onClick={() =>
                  accept.mutate({ quoteId: id, data: { signatureName: signatureName.trim() } })
                }
                className="rounded-none uppercase tracking-wider font-bold"
                data-testid="button-portal-accept-quote"
              >
                {accept.isPending ? "Accepting…" : "Accept & continue"}
              </Button>
            </div>
            <div className="pt-4 border-t border-border space-y-2">
              <Label className="text-muted-foreground">Or request changes / decline</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason or requested changes (optional)"
                className="rounded-none"
                data-testid="textarea-portal-decline"
              />
              <Button
                variant="outline"
                disabled={decline.isPending}
                onClick={() =>
                  decline.mutate({ quoteId: id, data: { reason: declineReason || undefined } })
                }
                className="rounded-none uppercase tracking-wider font-bold"
                data-testid="button-portal-decline-quote"
              >
                {decline.isPending ? "Sending…" : "Decline / request changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : decided ? (
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="py-4 text-sm">
            {data.status === "converted"
              ? `Accepted${data.acceptedAt ? ` on ${new Date(data.acceptedAt).toLocaleString("en-GB")}` : ""}.`
              : "This quote was declined."}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalThread subjectKind="quote" subjectId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
