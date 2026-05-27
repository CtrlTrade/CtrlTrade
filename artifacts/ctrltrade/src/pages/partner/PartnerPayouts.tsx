import { useState } from "react";
import { useListPartnerPayouts, useRequestPartnerPayout, getListPartnerPayoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function pounds(p: number) { return `£${(p / 100).toFixed(2)}`; }

export function PartnerPayouts() {
  const { data, isLoading } = useListPartnerPayouts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const request = useRequestPartnerPayout({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPartnerPayoutsQueryKey() });
        setNotes("");
        toast({ title: "Payout requested", description: "We'll review and process it shortly." });
      },
      onError: (err: any) => toast({ title: "Request failed", description: err.message, variant: "destructive" }),
    },
  });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Payouts</h1>
      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Request a payout</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); request.mutate({ data: { notes: notes || undefined } }); }} className="space-y-3">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the team" className="rounded-none" data-testid="input-payout-notes" />
            <Button type="submit" disabled={request.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-request-payout">Request payout of all available commission</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">History</CardTitle></CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No payouts yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Requested</th><th className="text-left py-2">Amount</th><th className="text-left py-2">Status</th><th className="text-left py-2">Reference</th>
              </tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2">{new Date(p.requestedAt).toLocaleDateString()}</td>
                    <td className="py-2 font-bold">{pounds(p.amountPence)}</td>
                    <td className="py-2"><Badge variant={p.status === "paid" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{p.status}</Badge></td>
                    <td className="py-2">{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
