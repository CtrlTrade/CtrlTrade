import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetPortalReferProgram,
  useSubmitPortalReferral,
  getGetPortalReferProgramQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PortalRefer() {
  const [, params] = useRoute("/portal/:tenantSlug/refer");
  const tenantSlug = params?.tenantSlug ?? "";
  const { data, isLoading } = useGetPortalReferProgram(tenantSlug);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const submit = useSubmitPortalReferral({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPortalReferProgramQueryKey(tenantSlug) });
        toast({ title: "Referral sent", description: "Thanks for spreading the word!" });
        setForm({ name: "", email: "", phone: "", message: "" });
      },
      onError: (err: any) => toast({ title: "Could not submit", description: err.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data || !data.enabled) return <div className="text-sm text-muted-foreground">This business is not running a referral program right now.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-none border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">{data.campaignName ?? "Refer a friend"}</CardTitle>
          <CardDescription>{data.rewardSummary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.description && <p className="text-sm">{data.description}</p>}
          {data.shareUrl && (
            <div className="space-y-2">
              <Label>Your share link</Label>
              <div className="flex gap-2">
                <Input readOnly value={data.shareUrl} className="rounded-none font-mono text-xs" />
                <Button type="button" variant="outline" className="rounded-none" onClick={() => { navigator.clipboard.writeText(data.shareUrl!); toast({ title: "Copied" }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {data.myCode && <div className="text-xs text-muted-foreground">Or share code <span className="font-mono font-bold">{data.myCode}</span></div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-none border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Tell us who to contact</CardTitle>
          <CardDescription>We'll reach out to your referral on your behalf.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submit.mutate({ tenantSlug, data: form }); }} className="space-y-3">
            <div className="space-y-2"><Label>Their name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-none" data-testid="input-refer-name" /></div>
            <div className="space-y-2"><Label>Their email (optional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Their phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Message (optional)</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded-none" /></div>
            <Button type="submit" disabled={submit.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-submit-referral">Send referral</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
