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
        <Skeleton className="h-10 w-72 bg-card" />
        <Skeleton className="h-32 w-full bg-card" />
        <Skeleton className="h-64 w-full bg-card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white p-8 max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold">Reseller Portal</h1>
        <Card className="rounded-xl border-border bg-background">
          <CardContent className="p-6 text-sm text-foreground/80">
            <p>You do not currently have reseller access. Contact your administrator to be added to a reseller programme.</p>
            <div className="mt-4 flex gap-3">
              <Link href="~/app" className="text-primary hover:text-red-400 text-xs font-semibold">Back to app</Link>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground text-xs font-semibold">Log out</button>
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
      <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
        <span className="font-bold tracking-tight text-primary">
          {displayName ?? "Reseller"} • Reseller Console
        </span>
        <div className="flex items-center gap-4">
          <Link href="~/app" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Main App</Link>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-xs font-semibold border-border text-foreground/80 hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>
      </header>
      <main className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reseller Dashboard</h1>
          <Button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold tracking-wider gap-2"
          >
            <Plus className="h-3 w-3" /> {showCreate ? "Cancel" : "New Child Tenant"}
          </Button>
        </div>

        {showCreate && (
          <Card className="rounded-xl border-border bg-background">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground/80">Provision Child Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Business name</Label>
                  <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Acme Plumbing" className="rounded-xl border-border bg-black text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">URL slug (optional)</Label>
                  <Input value={childSlug} onChange={(e) => setChildSlug(e.target.value)} placeholder="auto-generated from name" className="rounded-xl border-border bg-black text-white font-mono text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-3 border border-border p-3">
                <Switch checked={inheritWl} onCheckedChange={setInheritWl} />
                <div>
                  <div className="text-sm font-bold text-foreground">Inherit white-label settings</div>
                  <div className="text-xs text-muted-foreground">Copy your brand colors, logo, and white-label config onto the new tenant.</div>
                </div>
              </div>
              <Button onClick={handleCreateChild} disabled={createChild.isPending} className="rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold">
                {createChild.isPending ? "Creating…" : "Create child tenant"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" /> Active Child Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-white">{activeCount}</div>
              <div className="text-xs text-muted-foreground mt-1">{children.length} total</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> Network MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-white">{formatMoney(totalMrr, currency)}</div>
              <div className="text-xs text-muted-foreground mt-1">Across all child tenants</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                <Wallet className="h-3 w-3" /> Expected Payout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-primary">{formatMoney(expectedPayoutMrr, currency)}</div>
              <div className="text-xs text-muted-foreground mt-1">{revenueSharePct}% revenue share</div>
            </CardContent>
          </Card>
        </div>

        <div className="border border-border bg-background">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border font-semibold text-xs text-muted-foreground">
            <div className="col-span-3">Tenant</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Seats</div>
            <div className="col-span-1 text-right">Jobs</div>
            <div className="col-span-1 text-right">Leads</div>
            <div className="col-span-2 text-right">Paid Revenue</div>
            <div className="col-span-2 text-right">MRR</div>
          </div>
          {children.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono">No child tenants yet. Click "New Child Tenant" to provision one.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {children.map((c) => (
                <div key={c.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-3">
                    <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{c.slug} · {new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="col-span-1">
                    <span className={`px-2 py-1 text-[10px] font-bold ${
                      c.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                      c.status === 'trial' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      c.status === 'cancelled' ? 'bg-muted/60 text-muted-foreground border border-border' :
                      'bg-red-500/10 text-primary border border-red-500/20'
                    }`}>{c.status}</span>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground font-mono">
                    {c.controlSeats ?? 0}C / {c.fieldSeats ?? 0}F / {c.tills ?? 0}T
                  </div>
                  <div className="col-span-1 text-right font-mono text-foreground/80">{c.jobsCount}</div>
                  <div className="col-span-1 text-right font-mono text-foreground/80">{c.leadsCount}</div>
                  <div className="col-span-2 text-right font-mono text-foreground/80">
                    {formatMoney(c.paidRevenuePence / 100, c.currency ?? currency)}
                  </div>
                  <div className="col-span-2 text-right font-mono text-primary font-bold">
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
