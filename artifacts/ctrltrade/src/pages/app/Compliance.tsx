import { useState } from "react";
import {
  useListCertificates,
  useCreateCertificate,
  useListTeam,
  getListCertificatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader, useUpload } from "@workspace/object-storage-web";
import { Upload } from "lucide-react";

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function AppCompliance() {
  const { data, isLoading } = useListCertificates();
  const { data: team } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [holderUserId, setHolderUserId] = useState<string>("");
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const { getUploadParameters } = useUpload();
  const create = useCreateCertificate({
    mutation: {
      onSuccess: async (cert) => {
        qc.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        if (documentUrl && cert?.id) {
          try {
            await fetch(`/api/v1/files`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: documentUrl,
                kind: "compliance_cert",
                parentKind: "certificate",
                parentId: cert.id,
                name: documentUrl.split("/").pop(),
              }),
            });
          } catch {
            // non-fatal: documentUrl is still stored on the certificate row
          }
        }
        toast({ title: "Certificate added" });
        setOpen(false);
        setHolderUserId("");
        setDocumentUrl("");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const toIso = (k: string) => {
      const v = fd.get(k) as string;
      return v ? new Date(v).toISOString() : undefined;
    };
    create.mutate({
      data: {
        kind: String(fd.get("kind") ?? ""),
        holderUserId: holderUserId || undefined,
        holderLabel: (fd.get("holderLabel") as string) || undefined,
        reference: (fd.get("reference") as string) || undefined,
        issuedAt: toIso("issuedAt"),
        expiresAt: toIso("expiresAt"),
        documentUrl: documentUrl || (fd.get("documentUrl") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Compliance</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-certificate">
              <Plus className="h-4 w-4 mr-2" /> New Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-xl">
            <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Certificate</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Kind</Label><Input name="kind" required placeholder="Gas Safe / NICEIC / Insurance" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Holder (team member)</Label>
                  <Select value={holderUserId} onValueChange={setHolderUserId}>
                    <SelectTrigger><SelectValue placeholder="No member" /></SelectTrigger>
                    <SelectContent>{team?.members?.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Or holder label</Label><Input name="holderLabel" placeholder="Company-wide" /></div>
              </div>
              <div><Label>Reference</Label><Input name="reference" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Issued</Label><Input name="issuedAt" type="date" /></div>
                <div><Label>Expires</Label><Input name="expiresAt" type="date" /></div>
              </div>
              <div className="space-y-2">
                <Label>Certificate document</Label>
                <div className="flex items-center gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10 * 1024 * 1024}
                    onGetUploadParameters={getUploadParameters}
                    onComplete={(result) => {
                      const url = (result.successful?.[0] as { uploadURL?: string } | undefined)?.uploadURL;
                      if (url) setDocumentUrl(url);
                    }}
                    buttonClassName="inline-flex items-center gap-2 rounded-none uppercase tracking-wider font-bold bg-secondary text-secondary-foreground px-3 py-2 text-xs hover:opacity-90"
                  >
                    <Upload className="h-3 w-3" /> Upload document
                  </ObjectUploader>
                  {documentUrl && <span className="text-xs text-muted-foreground truncate">Uploaded</span>}
                </div>
                <Input
                  name="documentUrl"
                  type="url"
                  placeholder="…or paste a URL"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                />
              </div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No certificates yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Kind</TableHead><TableHead>Holder</TableHead>
                <TableHead>Reference</TableHead><TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((c) => {
                  const d = daysUntil(c.expiresAt);
                  const expired = d !== null && d < 0;
                  const expiring = d !== null && d >= 0 && d <= 30;
                  return (
                    <TableRow key={c.id} data-testid={`row-certificate-${c.id}`}>
                      <TableCell className="font-medium">{c.kind}</TableCell>
                      <TableCell>{c.holderLabel ?? c.holderUserId ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.reference ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {expired ? <Badge variant="destructive" className="rounded-none uppercase"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>
                          : expiring ? <Badge className="rounded-none uppercase bg-amber-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Expiring</Badge>
                          : <Badge variant="outline" className="rounded-none uppercase">Valid</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
