import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSession,
  useGetResellerDashboard,
  useCreateResellerChildTenant,
  useLogout,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Users, TrendingUp, Wallet, LogOut, Briefcase, MessageSquare, PoundSterling, Plus } from "lucide-react";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function ResellerDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const { data, isLoading, error } = useGetResellerDashboard({
    query: { queryKey: ["resellerDashboard"], retry: false, enabled: Boolean(session?.user) },
  });
  const createChild = useCreateResellerChildTenant();
  const logout = useLogout();
  const [showCreate, setShowCreate] = useState(false);
  const [childName, setChildName] = useState("");
  const [childSlug, setChildSlug] = useState("");
  const [inheritWl, setInheritWl] = useState(true);

  const handleCreateChild = () => {
    const name = childName.trim();
    if (name.length < 2) {
      toast({ title: "Name required", description: "Enter at least 2 characters.", variant: "destructive" });
      return;
    }
    createChild.mutate(
      { data: { name, slug: childSlug.trim() || undefined, inheritWhiteLabel: inheritWl } },
      {
        onSuccess: (t) => {
          toast({ title: "Child tenant created", description: `${t.name} (${t.slug}) is now in trial.` });
          setChildName("");
          setChildSlug("");
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["resellerDashboard"] });
        },
        onError: (e: any) =>
          toast({ title: "Create failed", description: String(e?.message ?? e), variant: "destructive" }),
      },
    );
  };

  useEffect(() => {
    if (!sessionLoading && !session?.user) setLocation("~/login");
  }, [sessionLoading, session, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("~/login") });
  };

  if (sessionLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8 space-y-4">
        <Skeleton className="h-10 w-72 bg-zinc-900" />
        <Skeleton className="h-32 w-full bg-zinc-900" />
        <Skeleton className="h-64 w-full bg-zinc-900" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white p-8 max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold">Reseller Portal</h1>
        <Card className="rounded-xl border-zinc-800 bg-zinc-950">
          <CardContent className="p-6 text-sm text-zinc-300">
            <p>You do not currently have reseller access. Contact your administrator to be added to a reseller programme.</p>
            <div className="mt-4 flex gap-3">
              <Link href="~/app" className="text-red-500 hover:text-red-400 uppercase text-xs font-bold">Back to app</Link>
              <button onClick={handleLogout} className="text-zinc-400 hover:text-white uppercase text-xs font-bold">Log out</button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totalMrr, expectedPayoutMrr, revenueSharePct, currency, children, displayName } = data;
  const activeCount = children.filter((c) => c.status === "active" || c.status === "trial").length;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6">
        <span className="font-bold tracking-tighter uppercase text-red-500">
          {displayName ?? "Reseller"} • Reseller Console
        </span>
        <div className="flex items-center gap-4">
          <Link href="~/app" className="text-xs uppercase font-bold text-zinc-400 hover:text-white">Main App</Link>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 uppercase text-xs tracking-wider font-bold border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>
      </header>
      <main className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reseller Dashboard</h1>
          <Button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-red-600 hover:bg-red-700 uppercase text-xs font-bold tracking-wider gap-2"
          >
            <Plus className="h-3 w-3" /> {showCreate ? "Cancel" : "New Child Tenant"}
          </Button>
        </div>

        {showCreate && (
          <Card className="rounded-xl border-zinc-800 bg-zinc-950">
            <CardHeader>
              <CardTitle className="uppercase text-sm tracking-wider text-zinc-300">Provision Child Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-zinc-500">Business name</Label>
                  <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Acme Plumbing" className="rounded-xl border-zinc-700 bg-black text-white" />
                </div>
                <div>
                  <Label className="text-xs uppercase text-zinc-500">URL slug (optional)</Label>
                  <Input value={childSlug} onChange={(e) => setChildSlug(e.target.value)} placeholder="auto-generated from name" className="rounded-xl border-zinc-700 bg-black text-white font-mono text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-3 border border-zinc-800 p-3">
                <Switch checked={inheritWl} onCheckedChange={setInheritWl} />
                <div>
                  <div className="text-sm font-bold text-zinc-100">Inherit white-label settings</div>
                  <div className="text-xs text-zinc-500">Copy your brand colors, logo, and white-label config onto the new tenant.</div>
                </div>
              </div>
              <Button onClick={handleCreateChild} disabled={createChild.isPending} className="rounded-xl bg-red-600 hover:bg-red-700 uppercase text-xs font-bold">
                {createChild.isPending ? "Creating…" : "Create child tenant"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-zinc-500 flex items-center gap-2">
                <Users className="h-3 w-3" /> Active Child Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-white">{activeCount}</div>
              <div className="text-xs text-zinc-500 mt-1">{children.length} total</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-zinc-500 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> Network MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-white">{formatMoney(totalMrr, currency)}</div>
              <div className="text-xs text-zinc-500 mt-1">Across all child tenants</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-zinc-500 flex items-center gap-2">
                <Wallet className="h-3 w-3" /> Expected Payout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-red-500">{formatMoney(expectedPayoutMrr, currency)}</div>
              <div className="text-xs text-zinc-500 mt-1">{revenueSharePct}% revenue share</div>
            </CardContent>
          </Card>
        </div>

        <div className="border border-zinc-800 bg-zinc-950">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 font-bold uppercase text-xs tracking-wider text-zinc-500">
            <div className="col-span-3">Tenant</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Seats</div>
            <div className="col-span-1 text-right">Jobs</div>
            <div className="col-span-1 text-right">Leads</div>
            <div className="col-span-2 text-right">Paid Revenue</div>
            <div className="col-span-2 text-right">MRR</div>
          </div>
          {children.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 font-mono">No child tenants yet. Click "New Child Tenant" to provision one.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {children.map((c) => (
                <div key={c.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-3">
                    <div className="font-bold text-zinc-100 uppercase text-sm truncate">{c.name}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate">{c.slug} · {new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="col-span-1">
                    <span className={`px-2 py-1 text-[10px] font-bold ${
                      c.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                      c.status === 'trial' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      c.status === 'cancelled' ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' :
                      'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>{c.status}</span>
                  </div>
                  <div className="col-span-2 text-xs text-zinc-400 font-mono">
                    {c.controlSeats ?? 0}C / {c.fieldSeats ?? 0}F / {c.tills ?? 0}T
                  </div>
                  <div className="col-span-1 text-right font-mono text-zinc-300">{c.jobsCount}</div>
                  <div className="col-span-1 text-right font-mono text-zinc-300">{c.leadsCount}</div>
                  <div className="col-span-2 text-right font-mono text-zinc-200">
                    {formatMoney(c.paidRevenuePence / 100, c.currency ?? currency)}
                  </div>
                  <div className="col-span-2 text-right font-mono text-red-500 font-bold">
                    {formatMoney(c.mrr, c.currency ?? currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
