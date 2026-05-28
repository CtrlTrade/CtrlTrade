import {
  useListAdminIntegrationCatalogue,
  useUpdateAdminIntegrationCatalogue,
  getListAdminIntegrationCatalogueQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export function AdminIntegrationCatalogue() {
  const { data, isLoading } = useListAdminIntegrationCatalogue();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAdminIntegrationCatalogueQueryKey() });
  const upd = useUpdateAdminIntegrationCatalogue({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Catalogue updated" }); },
      onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminPageHeader
        title="Integration catalogue"
        subtitle="Enable or disable third-party integrations for all tenants."
        icon={<Plug className="h-6 w-6" />}
      />

      <Card className="rounded-xl border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-base">Providers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-32">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-40">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-20">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((c) => (
                  <tr key={c.provider} className="hover:bg-muted/30 transition-colors" data-testid={`row-cat-${c.provider}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{c.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-xs">{c.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{c.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`rounded-xl text-xs whitespace-nowrap ${c.configured ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-amber-500/40 text-amber-400 bg-amber-500/10"}`}
                      >
                        {c.configured ? "Configured" : "Not configured"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={c.enabled}
                        onCheckedChange={(v) =>
                          upd.mutate({ provider: c.provider, data: { enabled: v, minPlan: c.minPlan ?? null } })
                        }
                        data-testid={`switch-cat-${c.provider}`}
                      />
                    </td>
                  </tr>
                ))}
                {(data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground font-mono">
                      No integrations configured.
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
