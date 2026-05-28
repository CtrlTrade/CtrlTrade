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
        title="Integration Catalogue"
        subtitle="Enable or disable third-party integrations for all tenants."
        icon={<Plug className="h-6 w-6" />}
      />

      <Card className="rounded-xl border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className=" text-base">Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Provider</th>
                <th className="text-left">Category</th>
                <th className="text-left">OAuth</th>
                <th className="text-left">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.provider} className="border-b border-border" data-testid={`row-cat-${c.provider}`}>
                  <td className="py-3">
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  </td>
                  <td className="text-xs">{c.category}</td>
                  <td>
                    <Badge
                      variant="outline"
                      className={`rounded-xl text-xs ${c.configured ? "border-green-700 text-green-400" : "border-amber-700 text-amber-400"}`}
                    >
                      {c.configured ? "Configured" : "Not configured"}
                    </Badge>
                  </td>
                  <td>
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
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
