import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetAdminTenantWhiteLabel,
  useUpdateAdminTenantWhiteLabel,
  useListAdminCustomDomains,
  useAddAdminCustomDomain,
  useDeleteAdminCustomDomain,
  useVerifyAdminCustomDomain,
  useListAdminTenantChildren,
  getGetAdminTenantWhiteLabelQueryKey,
  getListAdminCustomDomainsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";

export function AdminTenantWhiteLabel() {
  const { id } = useParams();
  const tenantId = id!;
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetAdminTenantWhiteLabel(tenantId);
  const { data: domains, isLoading: domainsLoading } = useListAdminCustomDomains(tenantId);
  const { data: children } = useListAdminTenantChildren(tenantId);

  const update = useUpdateAdminTenantWhiteLabel();
  const addDomain = useAddAdminCustomDomain();
  const deleteDomain = useDeleteAdminCustomDomain();
  const verifyDomain = useVerifyAdminCustomDomain();

  const [parentId, setParentId] = useState("");
  const [wl, setWl] = useState({
    hideCtrlTradeBranding: false,
    productName: "",
    supportEmail: "",
    supportPhone: "",
    outboundEmailDomain: "",
    outboundFromName: "",
    outboundFromEmail: "",
    legalEntity: "",
  });
  const [resellerEnabled, setResellerEnabled] = useState(false);
  const [reseller, setReseller] = useState({
    displayName: "",
    contactEmail: "",
    revenueSharePct: 0,
    notes: "",
    active: true,
  });

  const [newDomain, setNewDomain] = useState("");
  const [newDomainKind, setNewDomainKind] = useState<"portal" | "app">("portal");

  useEffect(() => {
    if (!data) return;
    setParentId(data.tenant.parentTenantId ?? "");
    const c = data.tenant.whiteLabelConfig ?? {};
    setWl({
      hideCtrlTradeBranding: Boolean(c.hideCtrlTradeBranding),
      productName: c.productName ?? "",
      supportEmail: c.supportEmail ?? "",
      supportPhone: c.supportPhone ?? "",
      outboundEmailDomain: c.outboundEmailDomain ?? "",
      outboundFromName: c.outboundFromName ?? "",
      outboundFromEmail: c.outboundFromEmail ?? "",
      legalEntity: c.legalEntity ?? "",
    });
    if (data.reseller) {
      setResellerEnabled(true);
      setReseller({
        displayName: data.reseller.displayName ?? "",
        contactEmail: data.reseller.contactEmail ?? "",
        revenueSharePct: data.reseller.revenueSharePct,
        notes: data.reseller.notes ?? "",
        active: data.reseller.active,
      });
    }
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetAdminTenantWhiteLabelQueryKey(tenantId) });
    qc.invalidateQueries({ queryKey: getListAdminCustomDomainsQueryKey(tenantId) });
  };

  const saveConfig = () => {
    update.mutate(
      {
        tenantId,
        data: {
          parentTenantId: parentId.trim() || null,
          whiteLabelConfig: {
            hideCtrlTradeBranding: wl.hideCtrlTradeBranding,
            productName: wl.productName.trim() || undefined,
            supportEmail: wl.supportEmail.trim() || undefined,
            supportPhone: wl.supportPhone.trim() || undefined,
            outboundEmailDomain: wl.outboundEmailDomain.trim() || undefined,
            outboundFromName: wl.outboundFromName.trim() || undefined,
            outboundFromEmail: wl.outboundFromEmail.trim() || undefined,
            legalEntity: wl.legalEntity.trim() || undefined,
          },
          reseller: resellerEnabled
            ? {
                displayName: reseller.displayName || undefined,
                contactEmail: reseller.contactEmail || undefined,
                revenueSharePct: Number(reseller.revenueSharePct) || 0,
                notes: reseller.notes || undefined,
                active: reseller.active,
              }
            : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "White-label configuration updated." });
          invalidate();
        },
        onError: (e: any) => toast({ title: "Save failed", description: String(e?.message ?? e), variant: "destructive" }),
      },
    );
  };

  const onAddDomain = () => {
    if (!newDomain.trim()) return;
    addDomain.mutate(
      { tenantId, data: { hostname: newDomain.trim(), kind: newDomainKind } },
      {
        onSuccess: () => {
          toast({ title: "Domain added", description: "Publish the TXT record then verify." });
          setNewDomain("");
          invalidate();
        },
        onError: (e: any) => toast({ title: "Add failed", description: String(e?.message ?? e), variant: "destructive" }),
      },
    );
  };

  const onVerifyDomain = (domainId: string) => {
    verifyDomain.mutate(
      { tenantId, domainId },
      {
        onSuccess: (d) => {
          toast({
            title: d.status === "verified" ? "Verified" : "Verification failed",
            description: d.status === "verified" ? `${d.hostname} is live.` : d.lastError ?? "Check TXT record",
            variant: d.status === "verified" ? "default" : "destructive",
          });
          invalidate();
        },
      },
    );
  };

  const onDeleteDomain = (domainId: string, hostname: string) => {
    if (!confirm(`Remove ${hostname}?`)) return;
    deleteDomain.mutate(
      { tenantId, domainId },
      {
        onSuccess: () => {
          toast({ title: "Domain removed" });
          invalidate();
        },
      },
    );
  };

  if (isLoading || !data) {
    return <div className="p-8"><Skeleton className="h-96 bg-card" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/tenants/${tenantId}`} className="text-xs uppercase font-bold text-zinc-400 hover:text-white flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to tenant
          </Link>
          <h1 className="text-3xl font-bold text-white mt-2">
            White Label · {data.tenant.name}
          </h1>
        </div>
        <Button onClick={saveConfig} disabled={update.isPending} className="rounded-xl bg-red-600 hover:bg-red-700 uppercase text-xs font-bold tracking-wider">
          {update.isPending ? "Saving…" : "Save Configuration"}
        </Button>
      </div>

      {/* Franchise parent */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-sm tracking-wider text-foreground">Franchise Parent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Parent tenant ID</Label>
            <Input
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID of the parent (reseller/franchise) tenant — leave empty for none"
              className="rounded-xl border-border bg-input text-foreground font-mono text-xs"
            />
            {data.parent && (
              <div className="text-xs text-zinc-400 mt-1">
                Currently nested under <span className="text-zinc-200 font-bold">{data.parent.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* White label */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-sm tracking-wider text-foreground">White Label Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border border-border p-3">
            <div>
              <div className="text-sm font-bold text-zinc-100">Hide CtrlTrade branding</div>
              <div className="text-xs text-muted-foreground">Removes "Powered by CtrlTrade" badges from this tenant's portal and outbound emails.</div>
            </div>
            <Switch checked={wl.hideCtrlTradeBranding} onCheckedChange={(v) => setWl({ ...wl, hideCtrlTradeBranding: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Product name</Label>
              <Input value={wl.productName} onChange={(e) => setWl({ ...wl, productName: e.target.value })} placeholder="e.g. PlumberOps" className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Legal entity</Label>
              <Input value={wl.legalEntity} onChange={(e) => setWl({ ...wl, legalEntity: e.target.value })} placeholder="Operator Ltd" className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Support email</Label>
              <Input value={wl.supportEmail} onChange={(e) => setWl({ ...wl, supportEmail: e.target.value })} placeholder="help@your-brand.com" className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Support phone</Label>
              <Input value={wl.supportPhone} onChange={(e) => setWl({ ...wl, supportPhone: e.target.value })} className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Outbound email domain</Label>
              <Input value={wl.outboundEmailDomain} onChange={(e) => setWl({ ...wl, outboundEmailDomain: e.target.value })} placeholder="mail.your-brand.com" className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Outbound "from" name</Label>
              <Input value={wl.outboundFromName} onChange={(e) => setWl({ ...wl, outboundFromName: e.target.value })} className="rounded-xl border-border bg-input text-foreground" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Outbound "from" email</Label>
              <Input value={wl.outboundFromEmail} onChange={(e) => setWl({ ...wl, outboundFromEmail: e.target.value })} placeholder="no-reply@your-brand.com" className="rounded-xl border-border bg-input text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reseller profile */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="uppercase text-sm tracking-wider text-foreground">Reseller Profile</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Enabled</span>
            <Switch checked={resellerEnabled} onCheckedChange={setResellerEnabled} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!resellerEnabled ? (
            <p className="text-xs text-muted-foreground">When enabled, members of this tenant can access the Reseller console at <code className="text-foreground">/reseller</code> and see MRR across child tenants.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Display name</Label>
                  <Input value={reseller.displayName} onChange={(e) => setReseller({ ...reseller, displayName: e.target.value })} className="rounded-xl border-border bg-input text-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contact email</Label>
                  <Input value={reseller.contactEmail} onChange={(e) => setReseller({ ...reseller, contactEmail: e.target.value })} className="rounded-xl border-border bg-input text-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Revenue share %</Label>
                  <Input type="number" min={0} max={100} value={reseller.revenueSharePct}
                    onChange={(e) => setReseller({ ...reseller, revenueSharePct: Number(e.target.value) })}
                    className="rounded-xl border-border bg-input text-foreground font-mono" />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Switch checked={reseller.active} onCheckedChange={(v) => setReseller({ ...reseller, active: v })} />
                    <span className="text-xs uppercase text-zinc-400">Active</span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea value={reseller.notes} onChange={(e) => setReseller({ ...reseller, notes: e.target.value })} className="rounded-xl border-border bg-input text-foreground" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Child tenants */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-sm tracking-wider text-foreground">Child Tenants ({children?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!children || children.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No child tenants yet. Assign this tenant ID as the parent on any child tenant to roll them up here.</p>
          ) : (
            <div className="divide-y divide-zinc-800 border border-border">
              {children.map((c) => (
                <div key={c.id} className="grid grid-cols-12 gap-4 p-3 items-center text-sm">
                  <div className="col-span-5 font-bold text-zinc-100">{c.name}</div>
                  <div className="col-span-3 text-xs text-zinc-400 font-mono">{c.status}</div>
                  <div className="col-span-3 font-mono text-foreground">MRR {c.currency ?? "GBP"} {c.mrr.toFixed(2)}</div>
                  <div className="col-span-1 text-right">
                    <Link href={`/tenants/${c.id}`} className="text-xs uppercase font-bold text-red-500 hover:text-red-400">View</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom domains */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="uppercase text-sm tracking-wider text-foreground">Custom Domains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Hostname</Label>
              <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="portal.your-brand.com" className="rounded-xl border-border bg-input text-foreground font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Kind</Label>
              <select value={newDomainKind} onChange={(e) => setNewDomainKind(e.target.value as "portal" | "app")} className="block w-32 h-10 px-2 border border-border bg-input text-foreground text-sm rounded-xl">
                <option value="portal">Portal</option>
                <option value="app">App</option>
              </select>
            </div>
            <Button onClick={onAddDomain} disabled={addDomain.isPending} className="rounded-xl bg-zinc-800 hover:bg-zinc-700 uppercase text-xs font-bold">Add</Button>
          </div>

          {domainsLoading ? (
            <Skeleton className="h-24 bg-card" />
          ) : !domains || domains.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No custom domains configured.</p>
          ) : (
            <div className="space-y-3">
              {domains.map((d) => (
                <div key={d.id} className="border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-zinc-100 font-mono">{d.hostname}</div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-1">{d.kind} domain</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 ${
                        d.status === 'verified' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                        d.status === 'failed' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        'bg-zinc-800 text-foreground border border-zinc-700'
                      }`}>
                        {d.status === 'verified' ? <ShieldCheck className="h-3 w-3" /> : d.status === 'failed' ? <AlertTriangle className="h-3 w-3" /> : null}
                        {d.status}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => onVerifyDomain(d.id)} disabled={verifyDomain.isPending} className="rounded-xl border-zinc-700 uppercase text-xs font-bold gap-1">
                        <RefreshCw className="h-3 w-3" /> Verify
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDeleteDomain(d.id, d.hostname)} className="rounded-xl border-zinc-700 uppercase text-xs font-bold gap-1 text-red-500 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 bg-black/50 border border-border p-2">
                    Publish TXT record at <span className="text-zinc-200">{d.hostname}</span>:
                    <pre className="mt-1 text-foreground whitespace-pre-wrap break-all">{`"ctrltrade-verify=${d.verificationToken}"`}</pre>
                    {d.lastError && <div className="text-red-400 mt-2">Last error: {d.lastError}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
