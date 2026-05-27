import { useState } from "react";
import {
  useListIntegrations,
  useListIntegrationProviders,
  useConnectIntegration,
  useDisconnectIntegration,
  useTriggerIntegrationSync,
  useGetIntegrationLogs,
  getListIntegrationsQueryKey,
  getGetIntegrationLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, Unplug, AlertTriangle, CheckCircle2, FileClock } from "lucide-react";

export function IntegrationsPanel() {
  const { data: providers, isLoading: lp } = useListIntegrationProviders();
  const { data: connections, isLoading: lc } = useListIntegrations();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });

  const connect = useConnectIntegration({
    mutation: {
      onSuccess: (d) => {
        if (d?.authUrl) window.location.href = d.authUrl;
      },
      onError: (e: any) => toast({ title: "Connect failed", description: e?.message, variant: "destructive" }),
    },
  });
  const disconnect = useDisconnectIntegration({
    mutation: { onSuccess: () => { invalidate(); toast({ title: "Disconnected" }); } },
  });
  const sync = useTriggerIntegrationSync({
    mutation: { onSuccess: () => toast({ title: "Sync queued" }) },
  });

  const [logsFor, setLogsFor] = useState<string | null>(null);

  if (lp || lc) return <Skeleton className="h-64" />;

  const byProvider = new Map((connections ?? []).map((c) => [c.provider, c]));

  return (
    <div className="space-y-4" data-testid="integrations-panel">
      <div>
        <h2 className="text-xl font-bold uppercase tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect Xero for two-way accounting sync, and Google or Outlook for calendar sync.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(providers ?? []).map((p) => {
          const conn = byProvider.get(p.id);
          const status = conn?.status ?? "disconnected";
          return (
            <Card key={p.id} className=" border-border" data-testid={`integration-card-${p.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="uppercase tracking-tight text-base">{p.label}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`rounded-none uppercase text-xs ${status === "connected" ? "border-green-600 text-green-700" : status === "error" ? "border-red-600 text-red-700" : "border-border text-muted-foreground"}`}
                    data-testid={`integration-status-${p.id}`}
                  >
                    {status}
                  </Badge>
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!p.configured && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
                    OAuth credentials not yet configured for this provider.
                  </div>
                )}
                {!p.enabled && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                    Disabled by administrator.
                  </div>
                )}
                {conn?.externalAccountLabel && (
                  <div className="text-xs text-muted-foreground">
                    Account: <span className="font-mono">{conn.externalAccountLabel}</span>
                  </div>
                )}
                {conn?.lastSyncAt && (
                  <div className="text-xs text-muted-foreground">
                    Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                  </div>
                )}
                {conn?.lastError && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{conn.lastError}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {status !== "connected" && (
                    <Button
                      size="sm"
                      className="rounded-none uppercase font-bold tracking-wider"
                      disabled={!p.enabled || !p.configured || connect.isPending}
                      onClick={() => connect.mutate({ provider: p.id })}
                      data-testid={`button-connect-${p.id}`}
                    >
                      <Plug className="h-3 w-3 mr-1" />
                      {status === "error" ? "Reconnect" : "Connect"}
                    </Button>
                  )}
                  {status === "connected" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none uppercase font-bold tracking-wider"
                        onClick={() => sync.mutate({ provider: p.id })}
                        disabled={sync.isPending}
                        data-testid={`button-sync-${p.id}`}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Sync now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none uppercase font-bold tracking-wider"
                        onClick={() => {
                          if (confirm(`Disconnect ${p.label}?`)) disconnect.mutate({ provider: p.id });
                        }}
                        data-testid={`button-disconnect-${p.id}`}
                      >
                        <Unplug className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-none uppercase font-bold tracking-wider"
                    onClick={() => setLogsFor(logsFor === p.id ? null : p.id)}
                    data-testid={`button-logs-${p.id}`}
                  >
                    <FileClock className="h-3 w-3 mr-1" /> {logsFor === p.id ? "Hide logs" : "View logs"}
                  </Button>
                </div>
                {logsFor === p.id && <SyncLogs provider={p.id} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SyncLogs({ provider }: { provider: string }) {
  const { data, isLoading } = useGetIntegrationLogs(provider);
  if (isLoading) return <Skeleton className="h-32" />;
  const rows = data ?? [];
  return (
    <div className="border-t border-border pt-3 mt-2 max-h-64 overflow-y-auto">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No sync activity yet.</p>}
      <ul className="space-y-1 text-xs font-mono">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2" data-testid={`log-row-${r.id}`}>
            {r.status === "ok" ? (
              <CheckCircle2 className="h-3 w-3 text-green-700 mt-0.5 shrink-0" />
            ) : r.status === "error" ? (
              <AlertTriangle className="h-3 w-3 text-red-700 mt-0.5 shrink-0" />
            ) : (
              <FileClock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            <span className="uppercase">{r.direction}</span>
            {r.entityKind && <span>{r.entityKind}</span>}
            <span className="truncate">{r.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
