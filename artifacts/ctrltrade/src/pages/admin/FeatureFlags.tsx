import { useState } from "react";
import {
  useListFeatureFlags,
  useUpsertFeatureFlag,
  useDeleteFeatureFlag,
  getListFeatureFlagsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Flag } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export function AdminFeatureFlags() {
  const { data, isLoading } = useListFeatureFlags();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListFeatureFlagsQueryKey() });
  const upsert = useUpsertFeatureFlag({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Flag saved" }); }, onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }) } });
  const del = useDeleteFeatureFlag({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Flag removed" }); } } });

  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newScope, setNewScope] = useState<"global" | "tenant">("global");
  const [newTenantId, setNewTenantId] = useState("");
  const [newPct, setNewPct] = useState(100);
  const [newEnabled, setNewEnabled] = useState(false);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 max-w-5xl">
      <AdminPageHeader
        title="Feature Flags"
        subtitle="Toggle features globally or per tenant. Rollout % controls progressive enablement."
        icon={<Flag className="h-6 w-6" />}
      />

      <Card className=" border-border">
        <CardHeader>
          <CardTitle className=" text-base">Create or update flag</CardTitle>
          <CardDescription>Using an existing key updates that flag.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              upsert.mutate({ data: { key: newKey, description: newDesc, enabled: newEnabled, rolloutPct: newPct, tenantId: newScope === "tenant" ? newTenantId : null } });
            }}
          >
            <div className="col-span-2"><Label>Key</Label><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} required className="rounded-xl" data-testid="input-flag-key" /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="rounded-xl" /></div>
            <div><Label>Scope</Label>
              <select value={newScope} onChange={(e) => setNewScope(e.target.value as any)} className="w-full h-10  border border-border bg-background px-2 text-sm"><option value="global">Global</option><option value="tenant">Tenant</option></select>
            </div>
            <div><Label>Rollout %</Label><Input type="number" min={0} max={100} value={newPct} onChange={(e) => setNewPct(Number(e.target.value))} className="rounded-xl" /></div>
            {newScope === "tenant" && <div className="col-span-3"><Label>Tenant ID</Label><Input value={newTenantId} onChange={(e) => setNewTenantId(e.target.value)} required className="rounded-xl font-mono text-xs" /></div>}
            <div className="flex items-center gap-2"><Switch checked={newEnabled} onCheckedChange={setNewEnabled} /> <span className="text-sm">Enabled</span></div>
            <Button type="submit" disabled={upsert.isPending} className="rounded-xl font-semibold" data-testid="button-flag-save">Save flag</Button>
          </form>
        </CardContent>
      </Card>

      <Card className=" border-border">
        <CardHeader><CardTitle className=" text-base">All flags</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border"><tr><th className="text-left py-2">Key</th><th className="text-left">Scope</th><th className="text-left">Tenant</th><th className="text-left">Rollout</th><th className="text-left">Enabled</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((f) => (
                <tr key={f.id} className="border-b border-border" data-testid={`row-flag-${f.key}`}>
                  <td className="py-2 font-mono text-xs">{f.key}</td>
                  <td className="text-xs">{f.scope}</td>
                  <td className="text-xs">{f.tenantName ?? "—"}</td>
                  <td><Input type="number" min={0} max={100} defaultValue={f.rolloutPct} className="rounded-xl h-8 w-20" onBlur={(e) => { const v = Number(e.target.value); if (v !== f.rolloutPct) upsert.mutate({ data: { key: f.key, enabled: f.enabled, rolloutPct: v, tenantId: f.tenantId, description: f.description ?? undefined } }); }} /></td>
                  <td><Switch checked={f.enabled} onCheckedChange={(v) => upsert.mutate({ data: { key: f.key, enabled: v, rolloutPct: f.rolloutPct, tenantId: f.tenantId, description: f.description ?? undefined } })} /></td>
                  <td className="text-right"><Button size="sm" variant="outline" className="rounded-xl" onClick={() => { if (confirm(`Delete flag "${f.key}"?`)) del.mutate({ flagId: f.id }); }}><Trash2 className="h-3 w-3" /></Button></td>
                </tr>
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No flags defined yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
