import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetAdminTenant, 
  useAdminUpdateTenantQuantities, 
  useAdminCancelTenant, 
  useAdminReactivateTenant, 
  useAdminSyncTenant,
  useGetAdminTenantAuditLog,
  useStartImpersonation,
  useAdminBillingOverride,
  useGetGdprDeletion,
  useScheduleGdprDeletion,
  useCancelGdprDeletion,
  usePurgeGdprDeletion,
  getGetGdprDeletionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle, ShieldCheck, UserCheck, Download, Trash2, Globe, Building2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Tab = "overview" | "billing" | "team" | "settings";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview",  label: "Overview"  },
  { id: "billing",   label: "Billing"   },
  { id: "team",      label: "Team"      },
  { id: "settings",  label: "Settings"  },
];

export function AdminTenantDetail() {
  const { id } = useParams();
  const { data: detail, isLoading, refetch } = useGetAdminTenant(id!);
  const { data: auditLog, isLoading: auditLoading } = useGetAdminTenantAuditLog(id!);

  const sync       = useAdminSyncTenant();
  const cancel     = useAdminCancelTenant();
  const reactivate = useAdminReactivateTenant();
  const updateQty  = useAdminUpdateTenantQuantities();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyForm, setQtyForm]         = useState({ controlSeats: 0, fieldSeats: 0, tills: 0 });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-zinc-900" />
        <Skeleton className="h-12 w-full bg-zinc-900" />
        <Skeleton className="h-64 bg-zinc-900" />
      </div>
    );
  }
  if (!detail) return <div className="p-8 text-red-500 font-mono">Tenant not found</div>;

  const { tenant, owner, subscription } = detail;

  const handleSync = () => {
    sync.mutate({ tenantId: id! }, {
      onSuccess: () => { toast({ title: "Sync triggered", description: "Fetching latest state from Stripe." }); refetch(); }
    });
  };
  const handleCancel = () => {
    if (confirm(`IMMEDIATE CANCEL: Are you sure you want to cancel ${tenant.name}?`)) {
      cancel.mutate({ tenantId: id! }, {
        onSuccess: () => { toast({ title: "Tenant cancelled", description: "Subscription terminated immediately." }); refetch(); }
      });
    }
  };
  const handleReactivate = () => {
    reactivate.mutate({ tenantId: id! }, {
      onSuccess: () => { toast({ title: "Tenant reactivated", description: "Subscription resumed." }); refetch(); }
    });
  };
  const handleUpdateQty = (e: React.FormEvent) => {
    e.preventDefault();
    updateQty.mutate({ tenantId: id!, data: qtyForm }, {
      onSuccess: () => { toast({ title: "Quantities updated" }); setShowQtyModal(false); refetch(); }
    });
  };
  const openQtyModal = () => {
    setQtyForm({ controlSeats: subscription.controlSeats, fieldSeats: subscription.fieldSeats, tills: subscription.tills });
    setShowQtyModal(true);
  };

  const statusCls =
    tenant.status === "active"    ? "bg-green-500/10 text-green-500 border-green-500/20" :
    tenant.status === "trial"     ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                    "bg-red-500/10 text-red-500 border-red-500/20";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={tenant.name}
        subtitle={owner.email}
        icon={<Building2 className="h-6 w-6" />}
        backHref="/tenants"
        actions={
          <>
            <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border ${statusCls}`}>
              {tenant.status}
            </span>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}
              className="rounded-none border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 font-bold uppercase text-xs">
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sync
            </Button>
            {tenant.status === "cancelled" ? (
              <Button variant="outline" size="sm" onClick={handleReactivate} disabled={reactivate.isPending}
                className="rounded-none border-green-900 bg-green-950 text-green-500 hover:bg-green-900 font-bold uppercase text-xs">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Reactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending}
                className="rounded-none border-red-900 bg-red-950 text-red-500 hover:bg-red-900 font-bold uppercase text-xs">
                <AlertTriangle className="mr-2 h-3.5 w-3.5" /> Force Cancel
              </Button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-red-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Identity & Owner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "ID",         value: <span className="font-mono text-zinc-300 text-xs">{tenant.id}</span> },
                { label: "Created",    value: <span className="font-mono text-zinc-300">{new Date(tenant.createdAt).toLocaleString()}</span> },
                { label: "Owner",      value: <span className="font-bold text-zinc-100">{owner.name}</span> },
                { label: "Email",      value: <span className="font-mono text-zinc-300">{owner.email}</span> },
                { label: "2FA",        value: (tenant as any).require2fa
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-green-500/10 text-green-500 border border-green-500/20"><ShieldCheck className="h-3 w-3" /> Enforced</span>
                  : <span className="text-xs text-zinc-500 font-mono">Not enforced</span> },
              ].map(({ label, value }) => (
                <div key={label} className="grid grid-cols-3 gap-2 border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase font-bold text-xs">{label}</span>
                  <span className="col-span-2">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Control Seats", value: subscription.controlSeats },
                  { label: "Field Seats",   value: subscription.fieldSeats   },
                  { label: "POS Tills",     value: subscription.tills         },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-zinc-800 bg-zinc-950 p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-zinc-100">{value}</div>
                    <div className="text-[10px] font-bold uppercase text-zinc-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase font-bold text-xs block mb-0.5">Branches</span>
                  <span className="font-mono text-zinc-300 font-bold">{detail.branchCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Billing */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Stripe identifiers */}
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Stripe Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={openQtyModal}
                className="h-6 text-xs uppercase font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-none">
                Edit Qty
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {([
                { label: "MRR",            node: <span className="font-mono text-red-500 font-bold">£{subscription.monthlyTotal}</span> },
                { label: "Currency",       node: <span className="font-mono text-zinc-300 uppercase">{subscription.currency}</span> },
                { label: "Stripe Customer", node: <span className="font-mono text-zinc-300 text-xs break-all" title={subscription.stripeCustomerId}>{subscription.stripeCustomerId}</span> },
                { label: "Stripe Sub",     node: <span className="font-mono text-zinc-300 text-xs break-all" title={subscription.stripeSubscriptionId}>{subscription.stripeSubscriptionId}</span> },
                { label: "Resources",      node: <span className="font-mono text-zinc-300 font-bold">{subscription.controlSeats}C / {subscription.fieldSeats}F / {subscription.tills}T</span> },
              ] as { label: string; node: React.ReactNode }[]).map(({ label, node }) => (
                <div key={label} className="grid grid-cols-3 gap-2 border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase font-bold text-xs">{label}</span>
                  <span className="col-span-2">{node}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming renewal */}
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Renewal Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {([
                {
                  label: "Next Renewal",
                  node: subscription.currentPeriodEnd
                    ? <span className="font-mono text-zinc-300">{new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    : <span className="text-zinc-600">—</span>,
                },
                {
                  label: "Trial Ends",
                  node: subscription.trialEndsAt
                    ? <span className="font-mono text-blue-400">{new Date(subscription.trialEndsAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    : <span className="text-zinc-600">Not on trial</span>,
                },
                {
                  label: "Cancel at Period End",
                  node: subscription.cancelAtPeriodEnd
                    ? <span className="text-red-500 font-bold uppercase text-xs">Yes — cancels at renewal</span>
                    : <span className="text-green-500 font-bold uppercase text-xs">No — auto-renews</span>,
                },
                {
                  label: "Sub Status",
                  node: <span className={`font-bold uppercase text-xs ${
                    subscription.status === "active"   ? "text-green-500" :
                    subscription.status === "trialing" ? "text-blue-400"  :
                    subscription.status === "past_due" ? "text-red-500"   : "text-zinc-400"
                  }`}>{subscription.status}</span>,
                },
              ] as { label: string; node: React.ReactNode }[]).map(({ label, node }) => (
                <div key={label} className="grid grid-cols-3 gap-2 border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase font-bold text-xs">{label}</span>
                  <span className="col-span-2">{node}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <CreditCard className="h-8 w-8 text-zinc-700" />
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Full invoice history in Stripe</p>
                <p className="text-[11px] text-zinc-600 max-w-xs">
                  Payment records are managed directly in Stripe. Use the Customer ID above to view all charges, refunds, and invoices.
                </p>
                <a
                  href={`https://dashboard.stripe.com/customers/${subscription.stripeCustomerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold uppercase tracking-wider text-red-500 hover:underline mt-1"
                >
                  Open in Stripe Dashboard →
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Team */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Control Seats",  value: subscription.controlSeats, desc: "Admin & office users"  },
              { label: "Field Seats",    value: subscription.fieldSeats,   desc: "Mobile / field workers" },
              { label: "POS Tills",      value: subscription.tills,        desc: "Point-of-sale devices"  },
              { label: "Branches",       value: detail.branchCount, desc: "Locations" },
            ].map(({ label, value, desc }) => (
              <div key={label} className="border border-zinc-800 bg-zinc-950 p-4 text-center">
                <div className="text-3xl font-mono font-bold text-zinc-100 mb-1">{value}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>

          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Seat Allocation</CardTitle>
              <Button variant="ghost" size="sm" onClick={openQtyModal}
                className="h-6 text-xs uppercase font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-none">
                Adjust Seats
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Control Seats", value: subscription.controlSeats, max: 100, color: "bg-blue-500" },
                { label: "Field Seats",   value: subscription.fieldSeats,   max: 200, color: "bg-green-500" },
                { label: "POS Tills",     value: subscription.tills,        max: 50,  color: "bg-purple-500" },
              ].map(({ label, value, max, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
                    <span className="text-xs font-mono text-zinc-300">{value}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900">
                    <div className={`h-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <Skeleton className="h-32 bg-zinc-900" />
              ) : !auditLog || auditLog.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-sm">No audit events yet.</div>
              ) : (
                <div className="divide-y divide-zinc-900 max-h-64 overflow-y-auto">
                  {auditLog.map((log) => (
                    <div key={log.id} className="py-2 flex gap-4 text-sm">
                      <div className="w-24 shrink-0 text-zinc-500 font-mono text-xs">{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div className="w-20 shrink-0 text-red-500/80 font-bold uppercase text-xs truncate">{log.kind}</div>
                      <div className="flex-1 text-zinc-300 text-xs">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <Card className="rounded-none border-zinc-800 bg-black shadow-none">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b border-zinc-900 pb-3">
                <span className="text-zinc-500 uppercase font-bold text-xs">2FA Policy</span>
                <span className="col-span-2">
                  {(tenant as any).require2fa ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                      <ShieldCheck className="h-3 w-3" /> Enforced for all users
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500 font-mono">Not enforced — user choice</span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          <AdminTenantTools tenantId={id!} status={tenant.status} />
        </div>
      )}

      {/* Qty modal */}
      <Dialog open={showQtyModal} onOpenChange={setShowQtyModal}>
        <DialogContent className="rounded-none border-zinc-800 bg-zinc-950 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight text-red-500">Override Quantities</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateQty} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="controlSeats" className="col-span-2 text-zinc-400">Control Seats</Label>
              <Input id="controlSeats" type="number" min="1" value={qtyForm.controlSeats}
                onChange={(e) => setQtyForm({ ...qtyForm, controlSeats: parseInt(e.target.value) })}
                className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fieldSeats" className="col-span-2 text-zinc-400">Field Seats</Label>
              <Input id="fieldSeats" type="number" min="0" value={qtyForm.fieldSeats}
                onChange={(e) => setQtyForm({ ...qtyForm, fieldSeats: parseInt(e.target.value) })}
                className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tills" className="col-span-2 text-zinc-400">POS Tills</Label>
              <Input id="tills" type="number" min="0" value={qtyForm.tills}
                onChange={(e) => setQtyForm({ ...qtyForm, tills: parseInt(e.target.value) })}
                className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateQty.isPending}
                className="rounded-none bg-red-600 text-white hover:bg-red-700 uppercase font-bold tracking-wider">
                {updateQty.isPending ? "Applying..." : "Force Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminTenantTools({ tenantId, status }: { tenantId: string; status: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: deletion } = useGetGdprDeletion(tenantId);
  const impersonate = useStartImpersonation({
    mutation: {
      onSuccess: () => { qc.invalidateQueries(); setLocation("~/app"); },
      onError: (e: any) => toast({ title: "Could not impersonate", description: e?.message, variant: "destructive" }),
    },
  });
  const billing = useAdminBillingOverride({ mutation: { onSuccess: () => toast({ title: "Billing override applied" }) } });
  const schedule = useScheduleGdprDeletion({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetGdprDeletionQueryKey(tenantId) }); toast({ title: "Deletion scheduled — 30 day cooldown" }); } } });
  const cancelDel = useCancelGdprDeletion({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetGdprDeletionQueryKey(tenantId) }); toast({ title: "Deletion cancelled" }); } } });
  const purge = usePurgeGdprDeletion({ mutation: { onSuccess: () => { toast({ title: "Tenant purged" }); setLocation("~/admin/tenants"); }, onError: (e: any) => toast({ title: "Cannot purge yet", description: e?.message, variant: "destructive" }) } });

  const [billingStatus, setBillingStatus] = useState(status);
  const [billingReason, setBillingReason] = useState("");
  const [delReason, setDelReason] = useState("");

  const exportUrl = `${import.meta.env.BASE_URL}api/v1/admin/tenants/${tenantId}/gdpr-export`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">White Label & Franchise</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-zinc-500">Configure branding overrides, custom domains, parent tenant, and reseller programme.</p>
          <Link href={`/tenants/${tenantId}/white-label`}>
            <Button className="w-full rounded-none bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-wider" data-testid="button-white-label">
              <Globe className="h-4 w-4 mr-2" /> Manage white label
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Impersonation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-zinc-500">Log into this tenant's workspace as the owner. Audited.</p>
          <Button onClick={() => impersonate.mutate({ tenantId })} disabled={impersonate.isPending} className="w-full rounded-none bg-amber-600 hover:bg-amber-700 text-black uppercase font-bold tracking-wider" data-testid="button-impersonate">
            <UserCheck className="h-4 w-4 mr-2" /> Impersonate owner
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Billing override</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label className="text-zinc-400 text-xs uppercase">Status</Label>
            <select value={billingStatus} onChange={(e) => setBillingStatus(e.target.value)} className="w-full h-9 rounded-none border border-zinc-700 bg-zinc-900 text-white px-2 text-sm" data-testid="select-billing-override">
              <option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Input value={billingReason} onChange={(e) => setBillingReason(e.target.value)} placeholder="Reason (audited)" className="rounded-none border-zinc-700 bg-zinc-900 text-white" data-testid="input-billing-reason" />
          <Button onClick={() => billing.mutate({ tenantId, data: { status: billingStatus, reason: billingReason || undefined } })} disabled={billing.isPending} className="w-full rounded-none bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-wider" data-testid="button-billing-override">Apply override</Button>
        </CardContent>
      </Card>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader><CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">GDPR</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <a href={exportUrl} className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-none border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 uppercase font-bold tracking-wider text-xs" data-testid="link-gdpr-export"><Download className="h-4 w-4" /> Export data (.zip)</a>
          {deletion && deletion.status === "pending" ? (
            <div className="space-y-2">
              <div className="text-xs text-amber-400 font-bold uppercase">Deletion scheduled</div>
              <div className="text-xs text-zinc-400">Purge at {deletion.scheduledPurgeAt ? new Date(deletion.scheduledPurgeAt).toLocaleString() : "—"}</div>
              <div className="flex gap-2">
                <Button onClick={() => cancelDel.mutate({ tenantId })} variant="outline" className="flex-1 rounded-none border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 uppercase font-bold text-xs" data-testid="button-cancel-deletion">Cancel</Button>
                <Button onClick={() => { if (confirm("PERMANENTLY DELETE this tenant and all data? This cannot be undone.")) purge.mutate({ tenantId }); }} disabled={!deletion.canPurgeNow} className="flex-1 rounded-none bg-red-700 hover:bg-red-800 text-white uppercase font-bold text-xs" data-testid="button-purge">{deletion.canPurgeNow ? "Purge now" : "Cooldown"}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Reason for deletion" className="rounded-none border-zinc-700 bg-zinc-900 text-white" data-testid="input-deletion-reason" />
              <Button onClick={() => { if (confirm("Schedule tenant deletion (30 day cooldown)?")) schedule.mutate({ tenantId, data: { reason: delReason || undefined } }); }} className="w-full rounded-none bg-red-700 hover:bg-red-800 text-white uppercase font-bold tracking-wider" data-testid="button-schedule-deletion"><Trash2 className="h-4 w-4 mr-2" /> Schedule deletion</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
