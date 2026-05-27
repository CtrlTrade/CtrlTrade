import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetAdminTenant, 
  useAdminUpdateTenantQuantities, 
  useAdminCancelTenant, 
  useAdminReactivateTenant, 
  useAdminSyncTenant,
  useGetAdminTenantAuditLog 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function AdminTenantDetail() {
  const { id } = useParams();
  const { data: detail, isLoading, refetch } = useGetAdminTenant(id!);
  const { data: auditLog, isLoading: auditLoading } = useGetAdminTenantAuditLog(id!);
  
  const sync = useAdminSyncTenant();
  const cancel = useAdminCancelTenant();
  const reactivate = useAdminReactivateTenant();
  const updateQty = useAdminUpdateTenantQuantities();
  
  const { toast } = useToast();
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyForm, setQtyForm] = useState({ controlSeats: 0, fieldSeats: 0, tills: 0 });

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 mb-8 bg-zinc-900" /></div>;
  if (!detail) return <div className="p-8 text-red-500">Tenant not found</div>;

  const { tenant, owner, subscription, recentEvents } = detail;

  const handleSync = () => {
    sync.mutate({ tenantId: id! }, {
      onSuccess: () => {
        toast({ title: "Sync triggered", description: "Fetching latest state from Stripe." });
        refetch();
      }
    });
  };

  const handleCancel = () => {
    if (confirm(`IMMEDIATE CANCEL: Are you sure you want to cancel ${tenant.name}?`)) {
      cancel.mutate({ tenantId: id! }, {
        onSuccess: () => {
          toast({ title: "Tenant cancelled", description: "Subscription terminated immediately." });
          refetch();
        }
      });
    }
  };

  const handleReactivate = () => {
    reactivate.mutate({ tenantId: id! }, {
      onSuccess: () => {
        toast({ title: "Tenant reactivated", description: "Subscription resumed." });
        refetch();
      }
    });
  };

  const handleUpdateQty = (e: React.FormEvent) => {
    e.preventDefault();
    updateQty.mutate({ tenantId: id!, data: qtyForm }, {
      onSuccess: () => {
        toast({ title: "Quantities updated" });
        setShowQtyModal(false);
        refetch();
      }
    });
  };

  const openQtyModal = () => {
    setQtyForm({
      controlSeats: subscription.controlSeats,
      fieldSeats: subscription.fieldSeats,
      tills: subscription.tills
    });
    setShowQtyModal(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/tenants" className="p-2 border border-zinc-800 bg-black text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold uppercase tracking-tighter text-white">{tenant.name}</h1>
        <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ml-auto ${
          tenant.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
          tenant.status === 'trial' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
          'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {tenant.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending} className="rounded-none border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 font-bold uppercase text-xs">
          <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} /> Sync Stripe
        </Button>
        {tenant.status === 'cancelled' ? (
          <Button variant="outline" size="sm" onClick={handleReactivate} disabled={reactivate.isPending} className="rounded-none border-green-900 bg-green-950 text-green-500 hover:bg-green-900 font-bold uppercase text-xs">
            <ShieldCheck className="mr-2 h-4 w-4" /> Reactivate
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending} className="rounded-none border-red-900 bg-red-950 text-red-500 hover:bg-red-900 font-bold uppercase text-xs">
            <AlertTriangle className="mr-2 h-4 w-4" /> Force Cancel
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="rounded-none border-zinc-800 bg-black shadow-none">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Identity & Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">ID</span>
              <span className="col-span-2 font-mono text-zinc-300">{tenant.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">Created</span>
              <span className="col-span-2 font-mono text-zinc-300">{new Date(tenant.createdAt).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">Owner Name</span>
              <span className="col-span-2 font-bold text-zinc-100">{owner.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">Owner Email</span>
              <span className="col-span-2 font-mono text-zinc-300">{owner.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-800 bg-black shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Subscription Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={openQtyModal} className="h-6 text-xs uppercase font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-none">Edit Qty</Button>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">MRR</span>
              <span className="col-span-2 font-mono text-red-500 font-bold">£{subscription.monthlyTotal}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">Stripe Cust</span>
              <span className="col-span-2 font-mono text-zinc-300 text-xs truncate" title={subscription.stripeCustomerId}>{subscription.stripeCustomerId}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 uppercase font-bold text-xs">Resources</span>
              <span className="col-span-2 font-mono text-zinc-300 font-bold">
                {subscription.controlSeats}C / {subscription.fieldSeats}F / {subscription.tills}T
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-zinc-100 text-sm">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? <Skeleton className="h-32 bg-zinc-900" /> : (
            <div className="divide-y divide-zinc-900">
              {auditLog?.map(log => (
                <div key={log.id} className="py-2 flex gap-4 text-sm">
                  <div className="w-32 shrink-0 text-zinc-500 font-mono text-xs">{new Date(log.createdAt).toLocaleDateString()}</div>
                  <div className="w-24 shrink-0 text-red-500/80 font-bold uppercase text-xs">{log.kind}</div>
                  <div className="flex-1 text-zinc-300">{log.message}</div>
                  <div className="w-32 shrink-0 text-zinc-600 font-mono text-xs truncate">{log.actor || 'system'}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showQtyModal} onOpenChange={setShowQtyModal}>
        <DialogContent className="rounded-none border-zinc-800 bg-zinc-950 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight text-red-500">Override Quantities</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateQty} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="controlSeats" className="col-span-2 text-zinc-400">Control Seats</Label>
              <Input id="controlSeats" type="number" min="1" value={qtyForm.controlSeats} onChange={e => setQtyForm({...qtyForm, controlSeats: parseInt(e.target.value)})} className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fieldSeats" className="col-span-2 text-zinc-400">Field Seats</Label>
              <Input id="fieldSeats" type="number" min="0" value={qtyForm.fieldSeats} onChange={e => setQtyForm({...qtyForm, fieldSeats: parseInt(e.target.value)})} className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tills" className="col-span-2 text-zinc-400">POS Tills</Label>
              <Input id="tills" type="number" min="0" value={qtyForm.tills} onChange={e => setQtyForm({...qtyForm, tills: parseInt(e.target.value)})} className="col-span-2 rounded-none border-zinc-700 bg-zinc-900 text-white" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateQty.isPending} className="rounded-none bg-red-600 text-white hover:bg-red-700 uppercase font-bold tracking-wider">
                {updateQty.isPending ? "Applying..." : "Force Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
