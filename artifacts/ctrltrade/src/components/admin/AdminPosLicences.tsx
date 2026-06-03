import { useState } from "react";
import {
  useAdminListPosLicences,
  useAdminIssuePosLicence,
  useAdminUpdatePosLicence,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MonitorSmartphone, KeyRound, Plus } from "lucide-react";

const STATUS_CLS: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  read_only: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  revoked: "bg-red-500/10 text-red-500 border-red-500/20",
};

function fmtMoney(pence: number, currency: string) {
  const symbol = currency.toLowerCase() === "gbp" ? "£" : "";
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

export function AdminPosLicences({ tenantId }: { tenantId: string }) {
  const { data, isLoading, refetch } = useAdminListPosLicences(tenantId);
  const issue = useAdminIssuePosLicence();
  const update = useAdminUpdatePosLicence();
  const { toast } = useToast();

  const [newType, setNewType] = useState<"web" | "desktop" | "hybrid">("web");
  const [newStatus, setNewStatus] = useState<"active" | "trial">("active");

  const handleIssue = () => {
    issue.mutate(
      { tenantId, data: { type: newType, status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: "Licence issued", description: `${newType} till licence (${newStatus}).` });
          refetch();
        },
        onError: () => toast({ title: "Failed to issue licence", variant: "destructive" }),
      },
    );
  };

  const setStatus = (licenceId: string, status: string, label: string) => {
    update.mutate(
      { licenceId, data: { status: status as never } },
      {
        onSuccess: () => {
          toast({ title: `Licence ${label}` });
          refetch();
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="rounded-xl border-border bg-black shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-foreground text-sm flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-red-500" /> CtrlTradePos® Licences
        </CardTitle>
        {data && (
          <span className="text-xs font-mono text-muted-foreground">
            {fmtMoney(data.monthlyTotalPence, data.currency)}/mo · {fmtMoney(data.pricePerTillPence, data.currency)}/till
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issue new licence */}
        <div className="flex flex-wrap items-end gap-2 border-b border-border pb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as typeof newType)}
              data-testid="select-admin-licence-type"
              className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5"
            >
              <option value="web">Web</option>
              <option value="desktop">Desktop</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
              data-testid="select-admin-licence-status"
              className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5"
            >
              <option value="active">Active</option>
              <option value="trial">Trial (14d)</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={handleIssue}
            disabled={issue.isPending}
            data-testid="button-issue-licence"
            className="rounded-lg bg-red-600 text-white hover:bg-red-600 font-semibold text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Issue Licence
          </Button>
        </div>

        {/* Licence list */}
        {isLoading ? (
          <Skeleton className="h-24 bg-card" />
        ) : !data || data.licences.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground font-mono text-xs">No POS licences issued.</div>
        ) : (
          <div className="space-y-3">
            {data.licences.map((lic) => (
              <div key={lic.id} className="border border-border bg-card p-3 rounded-lg" data-testid={`admin-licence-${lic.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-foreground/90 truncate">{lic.licenceKey}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{lic.type}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold border rounded ${STATUS_CLS[lic.status] ?? ""}`}>
                    {lic.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {lic.branchName ? `Branch: ${lic.branchName}` : "Unassigned"} · {lic.terminals.length} terminal
                  {lic.terminals.length === 1 ? "" : "s"}
                  {lic.lastCheckAt ? ` · last check ${new Date(lic.lastCheckAt).toLocaleDateString()}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lic.status !== "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(lic.id, "active", "activated")}
                      className="h-6 text-[11px] rounded border-green-900 bg-green-950 text-green-400 hover:bg-green-900">
                      Activate
                    </Button>
                  )}
                  {lic.status !== "suspended" && lic.status !== "revoked" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(lic.id, "suspended", "suspended")}
                      className="h-6 text-[11px] rounded border-orange-900 bg-orange-950 text-orange-400 hover:bg-orange-900">
                      Suspend
                    </Button>
                  )}
                  {lic.status !== "read_only" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(lic.id, "read_only", "set read-only")}
                      className="h-6 text-[11px] rounded border-amber-900 bg-amber-950 text-amber-400 hover:bg-amber-900">
                      Read-only
                    </Button>
                  )}
                  {lic.status !== "revoked" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm(`Revoke licence ${lic.licenceKey}? This permanently disables the till.`)) setStatus(lic.id, "revoked", "revoked");
                    }}
                      className="h-6 text-[11px] rounded border-red-900 bg-red-950 text-red-500 hover:bg-red-900">
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
