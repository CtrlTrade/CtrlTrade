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
      <AdminPageHeader title="Worker Queue" icon={<Cpu className="h-6 w-6" />} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["queued","running","done","failed","dead"] as const).map(s => (
          <Card key={s} className="rounded-xl border-border bg-black shadow-none">
            <CardContent className="p-6">
              <div className="font-bold text-xs text-muted-foreground mb-2">{s}</div>
              <div className={`text-3xl font-mono font-bold ${s === "failed" || s === "dead" ? "text-red-500" : s === "running" ? "text-yellow-500" : "text-foreground"}`} data-testid={`worker-depth-${s}`}>
                {data.depth[s]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-border bg-black shadow-none">
        <CardHeader><CardTitle className=" text-foreground">By Kind</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-800 border border-border">
            <div className="grid grid-cols-6 gap-2 p-3 text-xs text-muted-foreground font-bold bg-background">
              <div>Kind</div><div>Queued</div><div>Running</div><div>Done</div><div>Failed</div><div>Dead</div>
            </div>
            {data.byKind.map(k => (
              <div key={k.kind} className="grid grid-cols-6 gap-2 p-3 text-sm font-mono">
                <div className="text-foreground/90 font-bold">{k.kind}</div>
                <div>{k.queued}</div>
                <div className="text-yellow-500">{k.running}</div>
                <div className="text-green-500">{k.done}</div>
                <div className="text-red-400">{k.failed}</div>
                <div className="text-red-600 font-bold">{k.dead}</div>
              </div>
            ))}
            {data.byKind.length === 0 && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Cpu className="h-10 w-10 text-border" />
                <p className="font-bold text-sm text-muted-foreground">No jobs recorded</p>
                <p className="text-xs text-muted-foreground font-mono">Background jobs will appear here as they are queued.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-black shadow-none">
        <CardHeader><CardTitle className=" text-foreground">Recent 100 Jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-800 border border-border max-h-[600px] overflow-y-auto">
            {data.recent.map(j => (
              <div key={j.id} className="p-3 grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-3 font-mono text-foreground/90 font-bold truncate">{j.kind}</div>
                <div className={`col-span-1 text-xs font-semibold ${
                  j.status === "done" ? "text-green-500" :
                  j.status === "running" ? "text-yellow-500" :
                  j.status === "failed" ? "text-red-400" :
                  j.status === "dead" ? "text-red-600" : "text-muted-foreground"
                }`}>{j.status}</div>
                <div className="col-span-1 font-mono text-xs text-muted-foreground">{j.attempts}/{j.maxAttempts}</div>
                <div className="col-span-4 text-xs text-muted-foreground truncate">{j.lastError ?? <span className="text-border">—</span>}</div>
                <div className="col-span-2 text-xs font-mono text-muted-foreground">{new Date(j.updatedAt).toLocaleString()}</div>
                <div className="col-span-1 text-right">
                  {(j.status === "failed" || j.status === "dead") && (
                    <Button size="sm" variant="outline" disabled={retry.isPending} className="rounded-xl text-xs font-semibold border-border"
                      onClick={() => retry.mutate({ jobId: j.id })}
                      data-testid={`button-retry-${j.id}`}>
                      <RefreshCw className="h-3 w-3"/>
                    </Button>
                  )}
                  {j.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto"/>}
                  {j.status === "running" && <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto"/>}
                </div>
              </div>
            ))}
            {data.recent.length === 0 && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Cpu className="h-10 w-10 text-border" />
                <p className="font-bold text-sm text-muted-foreground">No recent jobs</p>
                <p className="text-xs text-muted-foreground font-mono">Completed and failed jobs will be listed here.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
