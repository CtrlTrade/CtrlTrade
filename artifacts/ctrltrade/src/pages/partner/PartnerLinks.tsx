import { useState } from "react";
import { useListPartnerLinks, useCreatePartnerLink, getListPartnerLinksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PartnerLinks() {
  const { data, isLoading } = useListPartnerLinks();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [landingPath, setLandingPath] = useState("/");
  const create = useCreatePartnerLink({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPartnerLinksQueryKey() });
        setLabel(""); setLandingPath("/");
      },
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Your Referral Links</h1>
      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Create new link</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate({ data: { label: label || undefined, landingPath } }); }} className="grid md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Newsletter, podcast…" className="rounded-none" data-testid="input-link-label" /></div>
            <div className="space-y-2"><Label>Landing path</Label><Input value={landingPath} onChange={(e) => setLandingPath(e.target.value)} className="rounded-none" data-testid="input-link-path" /></div>
            <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-create-link">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border">
        <CardHeader><CardTitle className="uppercase tracking-tight">Active links</CardTitle></CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No links yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr>
                <th className="text-left py-2">Label</th><th className="text-left py-2">Code</th><th className="text-left py-2">Share URL</th><th className="text-left py-2">Clicks</th>
              </tr></thead>
              <tbody>
                {data.map((link) => (
                  <tr key={link.id} className="border-t border-border">
                    <td className="py-2">{link.label ?? "—"}</td>
                    <td className="py-2 font-mono">{link.code}</td>
                    <td className="py-2 truncate max-w-md">
                      <button type="button" onClick={() => { navigator.clipboard.writeText(link.shareUrl); toast({ title: "Copied", description: link.shareUrl }); }} className="inline-flex items-center gap-2 underline" data-testid={`button-copy-${link.code}`}>
                        <Copy className="h-3 w-3" />{link.shareUrl}
                      </button>
                    </td>
                    <td className="py-2">{link.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
