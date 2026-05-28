import { useState } from "react";
import {
  useAdminListPartners,
  useAdminUpdatePartner,
  useAdminListPayouts,
  useAdminDecidePayout,
  getAdminListPartnersQueryKey,
  getAdminListPayoutsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Handshake } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";

function pounds(p: number) { return `£${(p / 100).toFixed(2)}`; }

export function AdminReferrals() {
  const { data: partners, isLoading: pLoad } = useAdminListPartners();
  const { data: payouts, isLoading: payLoad } = useAdminListPayouts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getAdminListPartnersQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminListPayoutsQueryKey() });
  };
  const update = useAdminUpdatePartner({ mutation: { onSuccess: invalidate } });
  const decide = useAdminDecidePayout({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Payout updated" }); } } });
  const [refs, setRefs] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Referral Partners"
        icon={<Handshake className="h-6 w-6" />}
      />
      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Partners</CardTitle></CardHeader>
        <CardContent>
          {pLoad ? <Skeleton className="h-32 w-full bg-zinc-900" /> : !partners || partners.length === 0 ? (
            <EmptyState
              icon={<Handshake className="h-10 w-10" />}
              heading="No partners yet"
              subtext="Referral partners will appear here once they sign up."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Partner</th><th className="text-left py-2">Status</th><th className="text-left py-2">Commission</th><th className="text-left py-2">Clicks / Signups / Paying</th><th className="text-left py-2">Accrued</th><th></th>
              </tr></thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.email}</div></td>
                    <td className="py-2"><Badge variant={p.status === "approved" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{p.status}</Badge></td>
                    <td className="py-2">{p.commissionType === "fixed" ? pounds(p.commissionFixedPence) : `${p.commissionPct}%`}</td>
                    <td className="py-2">{p.totals.clicks} / {p.totals.signups} / {p.totals.paying}</td>
                    <td className="py-2">{pounds(p.totals.accruedPence)}</td>
                    <td className="py-2 text-right space-x-2">
                      {p.status !== "approved" && <Button size="sm" variant="outline" className="rounded-none" onClick={() => update.mutate({ partnerId: p.id, data: { status: "approved" } })}>Approve</Button>}
                      {p.status !== "disabled" && <Button size="sm" variant="ghost" className="rounded-none text-destructive" onClick={() => update.mutate({ partnerId: p.id, data: { status: "disabled" } })}>Disable</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Payout requests</CardTitle></CardHeader>
        <CardContent>
          {payLoad ? <Skeleton className="h-32 w-full bg-zinc-900" /> : !payouts || payouts.length === 0 ? (
            <EmptyState
              icon={<Handshake className="h-10 w-10" />}
              heading="No payouts pending"
              subtext="Partner payout requests will appear here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Partner</th><th className="text-left py-2">Amount</th><th className="text-left py-2">Status</th><th className="text-left py-2">Reference</th><th></th>
              </tr></thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2"><div className="font-medium">{p.partnerName}</div><div className="text-xs text-muted-foreground">{p.partnerEmail}</div></td>
                    <td className="py-2 font-bold">{pounds(p.amountPence)}</td>
                    <td className="py-2"><Badge variant={p.status === "paid" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{p.status}</Badge></td>
                    <td className="py-2 w-48"><Input value={refs[p.id] ?? p.reference ?? ""} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} className="rounded-none h-8" placeholder="Bank ref" /></td>
                    <td className="py-2 text-right space-x-2">
                      {p.status === "requested" && <Button size="sm" variant="outline" className="rounded-none" onClick={() => decide.mutate({ payoutId: p.id, data: { status: "approved" } })}>Approve</Button>}
                      {p.status !== "paid" && p.status !== "rejected" && <Button size="sm" className="rounded-none" onClick={() => decide.mutate({ payoutId: p.id, data: { status: "paid", reference: refs[p.id] } })}>Mark paid</Button>}
                      {p.status === "requested" && <Button size="sm" variant="ghost" className="rounded-none text-destructive" onClick={() => decide.mutate({ payoutId: p.id, data: { status: "rejected" } })}>Reject</Button>}
                    </td>
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
