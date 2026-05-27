import { useState } from "react";
import {
  useListReferralCampaigns,
  useCreateReferralCampaign,
  useUpdateReferralCampaign,
  useDeleteReferralCampaign,
  useListReferralConversions,
  useIssueReferralReward,
  getListReferralCampaignsQueryKey,
  getListReferralConversionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const empty = { name: "", rewardType: "fixed" as "fixed" | "percent" | "cash", rewardValuePence: 1000, rewardForReferrer: true, rewardForReferee: false, description: "", active: true };

export function SettingsReferrals() {
  const { data: campaigns, isLoading } = useListReferralCampaigns();
  const { data: conversions } = useListReferralConversions();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListReferralCampaignsQueryKey() });
    qc.invalidateQueries({ queryKey: getListReferralConversionsQueryKey() });
  };

  const create = useCreateReferralCampaign({ mutation: { onSuccess: () => { invalidate(); setForm(empty); setEditing(null); } } });
  const update = useUpdateReferralCampaign({ mutation: { onSuccess: () => { invalidate(); setForm(empty); setEditing(null); } } });
  const del = useDeleteReferralCampaign({ mutation: { onSuccess: invalidate } });
  const reward = useIssueReferralReward({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Reward issued" }); } } });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { data: form };
    if (editing) update.mutate({ campaignId: editing, ...payload });
    else create.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-none border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">{editing ? "Edit campaign" : "New campaign"}</CardTitle>
          <CardDescription>Reward your existing customers for referring new ones.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-none" data-testid="input-campaign-name" /></div>
            <div className="space-y-2">
              <Label>Reward type</Label>
              <Select value={form.rewardType} onValueChange={(v: "fixed" | "percent" | "cash") => setForm({ ...form, rewardType: v })}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed credit (£)</SelectItem>
                  <SelectItem value="percent">Percent discount (%)</SelectItem>
                  <SelectItem value="cash">Cash reward (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{form.rewardType === "percent" ? "Percent (%)" : "Amount (pence)"}</Label><Input type="number" min={0} required value={form.rewardValuePence} onChange={(e) => setForm({ ...form, rewardValuePence: Number(e.target.value) })} className="rounded-none" data-testid="input-campaign-value" /></div>
            <div className="md:col-span-2 flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={form.rewardForReferrer} onCheckedChange={(c) => setForm({ ...form, rewardForReferrer: !!c })} /> Reward the referrer</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.rewardForReferee} onCheckedChange={(c) => setForm({ ...form, rewardForReferee: !!c })} /> Reward the new customer</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: !!c })} /> Active</label>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-none" /></div>
            <div className="md:col-span-2 flex gap-3">
              <Button type="submit" disabled={create.isPending || update.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-save-campaign">{editing ? "Update" : "Create"} campaign</Button>
              {editing && <Button type="button" variant="outline" className="rounded-none" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Active campaigns</CardTitle></CardHeader>
        <CardContent>
          {!campaigns || campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No campaigns yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Name</th><th className="text-left py-2">Reward</th><th className="text-left py-2">Targets</th><th className="text-left py-2">Active</th><th></th>
              </tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2">{c.rewardType === "percent" ? `${c.rewardValuePence}%` : `£${(c.rewardValuePence/100).toFixed(2)}`}</td>
                    <td className="py-2 text-xs">{[c.rewardForReferrer && "Referrer", c.rewardForReferee && "Referee"].filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-2"><Badge variant={c.active ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{c.active ? "Yes" : "No"}</Badge></td>
                    <td className="py-2 text-right space-x-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => { setEditing(c.id); setForm({ name: c.name, rewardType: c.rewardType as any, rewardValuePence: c.rewardValuePence, rewardForReferrer: c.rewardForReferrer, rewardForReferee: c.rewardForReferee, description: c.description ?? "", active: c.active }); }}>Edit</Button>
                      <Button type="button" variant="ghost" size="sm" className="rounded-none text-destructive" onClick={() => del.mutate({ campaignId: c.id })}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Referrals received</CardTitle></CardHeader>
        <CardContent>
          {!conversions || conversions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No referrals yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Campaign</th><th className="text-left py-2">Referrer</th><th className="text-left py-2">New customer</th><th className="text-left py-2">Status</th><th></th>
              </tr></thead>
              <tbody>
                {conversions.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2">{c.campaignName}</td>
                    <td className="py-2">{c.referrerName ?? "—"}</td>
                    <td className="py-2">{c.refereeName ?? c.refereeEmail ?? "—"}</td>
                    <td className="py-2"><Badge variant={c.status === "rewarded" ? "default" : "secondary"} className="rounded-none uppercase tracking-wider">{c.status}</Badge></td>
                    <td className="py-2 text-right">
                      {c.status !== "rewarded" && (
                        <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => reward.mutate({ conversionId: c.id })}>Issue reward</Button>
                      )}
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
