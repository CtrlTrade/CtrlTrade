import { useState } from "react";
import {
  useListPosLicences,
  useRequestExtraTill,
  useRegisterPosTerminal,
  useUpdatePosTerminal,
  useUpdatePosLicenceBranch,
  useListBranches,
  useValidatePosLicence,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, MonitorSmartphone, Plus, Monitor, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";

const STATUS_CLS: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  trial: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  read_only: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  suspended: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  expired: "bg-muted text-muted-foreground border-border",
  revoked: "bg-red-500/10 text-red-600 border-red-500/20",
};

const MODE_LABEL: Record<string, string> = {
  trade_counter: "Trade Counter",
  showroom: "Showroom",
  warehouse: "Warehouse",
};

function fmtMoney(pence: number, currency: string) {
  const symbol = currency.toLowerCase() === "gbp" ? "£" : "";
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

type ValidationResult = {
  valid: boolean;
  mode: "full" | "read_only" | "locked";
  status: string;
  message: string | null;
};

export function PosLicences() {
  const { data, isLoading, refetch } = useListPosLicences();
  const { data: branches } = useListBranches();
  const requestTill = useRequestExtraTill();
  const registerTerminal = useRegisterPosTerminal();
  const updateTerminal = useUpdatePosTerminal();
  const assignBranch = useUpdatePosLicenceBranch();
  const validateLicence = useValidatePosLicence();
  const { toast } = useToast();

  const [reqType, setReqType] = useState<"web" | "desktop" | "hybrid">("web");
  const [terminalName, setTerminalName] = useState<Record<string, string>>({});
  const [validateKey, setValidateKey] = useState<Record<string, string>>({});
  const [validateTerminal, setValidateTerminal] = useState<Record<string, string>>({});
  const [validateResults, setValidateResults] = useState<Record<string, ValidationResult>>({});

  const handleRequest = () => {
    requestTill.mutate(
      { data: { type: reqType } },
      {
        onSuccess: () => {
          toast({ title: "Extra till requested", description: "A 14-day trial licence has been added." });
          refetch();
        },
        onError: () => toast({ title: "Request failed", variant: "destructive" }),
      },
    );
  };

  const handleAddTerminal = (licenceId: string) => {
    const name = (terminalName[licenceId] ?? "").trim();
    if (!name) {
      toast({ title: "Enter a terminal name", variant: "destructive" });
      return;
    }
    registerTerminal.mutate(
      { data: { name, licenceId } },
      {
        onSuccess: () => {
          toast({ title: "Terminal registered" });
          setTerminalName((s) => ({ ...s, [licenceId]: "" }));
          refetch();
        },
        onError: () => toast({ title: "Registration failed", variant: "destructive" }),
      },
    );
  };

  const handleAssignBranch = (licenceId: string, branchId: string) => {
    assignBranch.mutate(
      { licenceId, data: { branchId: branchId || null } },
      {
        onSuccess: () => {
          toast({ title: "Branch assigned" });
          refetch();
        },
        onError: () => toast({ title: "Assign failed", variant: "destructive" }),
      },
    );
  };

  const cycleMode = (terminalId: string, current: string) => {
    const order = ["trade_counter", "showroom", "warehouse"] as const;
    const next = order[(order.indexOf(current as never) + 1) % order.length];
    updateTerminal.mutate(
      { terminalId, data: { mode: next } },
      { onSuccess: () => refetch(), onError: () => toast({ title: "Update failed", variant: "destructive" }) },
    );
  };

  const toggleTerminal = (terminalId: string, current: string) => {
    updateTerminal.mutate(
      { terminalId, data: { status: current === "active" ? "inactive" : "active" } },
      { onSuccess: () => refetch(), onError: () => toast({ title: "Update failed", variant: "destructive" }) },
    );
  };

  const handleValidate = (licenceId: string, licenceKey: string, surface: "web" | "desktop") => {
    const key = (validateKey[licenceId] ?? licenceKey).trim();
    const terminal = (validateTerminal[licenceId] ?? "").trim();
    setValidateResults((s) => ({ ...s, [licenceId]: undefined as unknown as ValidationResult }));
    validateLicence.mutate(
      { data: { licenceKey: key, terminalCode: terminal || undefined, surface } },
      {
        onSuccess: (result) => {
          setValidateResults((s) => ({
            ...s,
            [licenceId]: { valid: result.valid, mode: result.mode as "full" | "read_only" | "locked", status: result.status, message: result.message ?? null },
          }));
        },
        onError: () => toast({ title: "Validation failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5 text-primary" /> Till Licences & Terminals
        </CardTitle>
        {data && (
          <span className="text-xs text-muted-foreground">
            {fmtMoney(data.monthlyTotalPence, data.currency)}/mo · {fmtMoney(data.pricePerTillPence, data.currency)} per till
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Request extra till */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <span className="text-xs font-medium text-muted-foreground">Need another till?</span>
          <select
            value={reqType}
            onChange={(e) => setReqType(e.target.value as typeof reqType)}
            data-testid="select-request-till-type"
            className="bg-background border border-border text-sm rounded-md px-2 py-1.5"
          >
            <option value="web">Web POS</option>
            <option value="desktop">Desktop POS</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <Button size="sm" onClick={handleRequest} disabled={requestTill.isPending} data-testid="button-request-till">
            <Plus className="mr-1 h-3.5 w-3.5" /> Request extra till
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !data || data.licences.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No till licences yet. Request one above or contact CtrlTrade support.
          </div>
        ) : (
          <div className="space-y-3">
            {data.licences.map((lic) => (
              <div key={lic.id} className="border border-border rounded-lg p-3" data-testid={`licence-${lic.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm truncate">{lic.licenceKey}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{lic.type}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded ${STATUS_CLS[lic.status] ?? ""}`}>
                    {lic.status.replace("_", " ")}
                  </span>
                </div>

                {/* Branch assignment */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Branch</span>
                  <select
                    value={lic.branchId ?? ""}
                    onChange={(e) => handleAssignBranch(lic.id, e.target.value)}
                    data-testid={`select-licence-branch-${lic.id}`}
                    className="bg-background border border-border text-xs rounded-md px-2 py-1 flex-1 max-w-xs"
                  >
                    <option value="">Unassigned</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Terminals */}
                <div className="mt-3 space-y-1.5">
                  {lic.terminals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No terminals registered on this licence.</p>
                  ) : (
                    lic.terminals.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5" data-testid={`terminal-${t.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono">{t.terminalCode}</span>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => cycleMode(t.id, t.mode)}
                            data-testid={`button-mode-${t.id}`}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted"
                          >
                            {MODE_LABEL[t.mode] ?? t.mode}
                          </button>
                          <button
                            onClick={() => toggleTerminal(t.id, t.status)}
                            data-testid={`button-toggle-${t.id}`}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              t.status === "active"
                                ? "border-green-500/30 text-green-600 bg-green-500/10"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {t.status}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add terminal */}
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={terminalName[lic.id] ?? ""}
                    onChange={(e) => setTerminalName((s) => ({ ...s, [lic.id]: e.target.value }))}
                    placeholder="New terminal name"
                    data-testid={`input-terminal-name-${lic.id}`}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddTerminal(lic.id)}
                    disabled={registerTerminal.isPending}
                    data-testid={`button-add-terminal-${lic.id}`}
                    className="h-8 text-xs shrink-0"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>

                {/* Validate till-open */}
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest mb-2">Validate Till Open</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={validateTerminal[lic.id] ?? ""}
                      onChange={(e) => setValidateTerminal((s) => ({ ...s, [lic.id]: e.target.value }))}
                      placeholder="Terminal code (e.g. POS-001)"
                      data-testid={`input-validate-terminal-${lic.id}`}
                      className="h-8 text-xs flex-1 min-w-[160px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleValidate(lic.id, lic.licenceKey, lic.type === "desktop" ? "desktop" : "web")}
                      disabled={validateLicence.isPending}
                      data-testid={`button-validate-${lic.id}`}
                      className="h-8 text-xs shrink-0"
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Validate
                    </Button>
                  </div>
                  {validateResults[lic.id] && (() => {
                    const r = validateResults[lic.id];
                    const Icon = r.mode === "full" ? ShieldCheck : r.mode === "read_only" ? ShieldAlert : ShieldX;
                    const cls = r.mode === "full"
                      ? "bg-green-500/10 border-green-500/20 text-green-700"
                      : r.mode === "read_only"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                        : "bg-red-500/10 border-red-500/20 text-red-700";
                    return (
                      <div className={`mt-2 flex items-start gap-2 rounded border px-2.5 py-2 text-xs ${cls}`} data-testid={`validate-result-${lic.id}`}>
                        <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold uppercase tracking-wide">{r.mode.replace("_", " ")}</span>
                          {r.message && <span className="ml-2 font-normal">{r.message}</span>}
                          {!r.message && r.mode === "full" && <span className="ml-2 font-normal">Licence is valid — till may open.</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
