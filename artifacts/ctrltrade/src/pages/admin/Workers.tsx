import { useGetAdminWorkers, useRetryAdminWorkerJob, getGetAdminWorkersQueryKey } from "@workspace/api-client-react";
import type { AdminWorkers as AdminWorkersData } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, CheckCircle2, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export function AdminWorkers() {
  const { data: rawData, isLoading } = useGetAdminWorkers({
    query: {
      queryKey: getGetAdminWorkersQueryKey(),
      refetchInterval: 5000,
    },
  });
  const data = rawData as AdminWorkersData | undefined;
  const qc = useQueryClient();
  const { toast } = useToast();
  const retry = useRetryAdminWorkerJob({
    mutation: {
      onSuccess: () => {
        toast({ title: "Job re-queued" });
        void qc.invalidateQueries({ queryKey: getGetAdminWorkersQueryKey() });
      },
      onError: (err: any) => toast({ title: "Retry failed", description: err.message, variant: "destructive" }),
    },
  });

  if (isLoading || !data) return <div className="p-8 space-y-4"><Skeleton className="h-32"/><Skeleton className="h-96"/></div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Worker queue" icon={<Cpu className="h-6 w-6" />} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["queued","running","done","failed","dead"] as const).map(s => (
          <Card key={s} className="rounded-xl border-border bg-card shadow-none">
            <CardContent className="p-5">
              <div className="font-semibold text-xs text-muted-foreground mb-2 capitalize">{s}</div>
              <div className={`text-3xl font-mono font-bold ${s === "failed" || s === "dead" ? "text-red-400" : s === "running" ? "text-amber-400" : "text-foreground"}`} data-testid={`worker-depth-${s}`}>
                {data.depth[s]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Kind */}
      <Card className="rounded-xl border-border bg-card shadow-none">
        <CardHeader><CardTitle className="text-foreground text-base">By kind</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground w-1/2">Kind</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Queued</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Running</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Done</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Failed</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Dead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byKind.map(k => (
                  <tr key={k.kind} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-foreground/90 font-semibold text-xs">{k.kind}</td>
                    <td className="p-3 text-center font-mono text-xs text-muted-foreground">{k.queued}</td>
                    <td className="p-3 text-center font-mono text-xs text-amber-400">{k.running}</td>
                    <td className="p-3 text-center font-mono text-xs text-green-400">{k.done}</td>
                    <td className="p-3 text-center font-mono text-xs text-red-400">{k.failed}</td>
                    <td className="p-3 text-center font-mono text-xs text-red-500 font-bold">{k.dead}</td>
                  </tr>
                ))}
                {data.byKind.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Cpu className="h-10 w-10 text-border" />
                        <p className="font-semibold text-sm text-muted-foreground">No jobs recorded</p>
                        <p className="text-xs text-muted-foreground font-mono">Background jobs will appear here as they are queued.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent jobs */}
      <Card className="rounded-xl border-border bg-card shadow-none">
        <CardHeader><CardTitle className="text-foreground text-base">Recent 100 jobs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Kind</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Attempts</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Last error</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Updated</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recent.map(j => (
                  <tr key={j.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-foreground/90 font-semibold text-xs max-w-[160px] truncate">{j.kind}</td>
                    <td className={`p-3 text-xs font-semibold ${
                      j.status === "done"    ? "text-green-400" :
                      j.status === "running" ? "text-amber-400" :
                      j.status === "failed"  ? "text-red-400"   :
                      j.status === "dead"    ? "text-red-500"   : "text-muted-foreground"
                    }`}>{j.status}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{j.attempts}/{j.maxAttempts}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{j.lastError ?? <span className="text-border">—</span>}</td>
                    <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{new Date(j.updatedAt).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      {(j.status === "failed" || j.status === "dead") && (
                        <Button size="sm" variant="outline" disabled={retry.isPending}
                          className="rounded-xl text-xs font-semibold border-border h-7 w-7 p-0"
                          onClick={() => retry.mutate({ jobId: j.id })}
                          data-testid={`button-retry-${j.id}`}>
                          <RefreshCw className="h-3 w-3"/>
                        </Button>
                      )}
                      {j.status === "done"    && <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto"/>}
                      {j.status === "running" && <AlertTriangle className="h-4 w-4 text-amber-400 ml-auto"/>}
                    </td>
                  </tr>
                ))}
                {data.recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Cpu className="h-10 w-10 text-border" />
                        <p className="font-semibold text-sm text-muted-foreground">No recent jobs</p>
                        <p className="text-xs text-muted-foreground font-mono">Completed and failed jobs will be listed here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
