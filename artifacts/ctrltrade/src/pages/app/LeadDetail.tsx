import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetLead,
  useUpdateLead,
  useAddLeadNote,
  useLogLeadActivity,
  useConvertLeadToQuote,
  useLoseLead,
  useDeleteLead,
  useAddLeadFile,
  useDeleteLeadFile,
  useListTeam,
  getGetLeadQueryKey,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  StickyNote,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowRight,
  Clock,
  Paperclip,
  ExternalLink,
} from "lucide-react";

function fmtGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

export function AppLeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const [, setLocation] = useLocation();
  const leadId = params?.id ?? "";
  const { data: lead, isLoading } = useGetLead(leadId);
  const { data: team } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [noteBody, setNoteBody] = useState("");
  const [actKind, setActKind] = useState("call");
  const [actSubject, setActSubject] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [loseOpen, setLoseOpen] = useState(false);
  const [loseReason, setLoseReason] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
  };

  const update = useUpdateLead({ mutation: { onSuccess: invalidate } });
  const addNote = useAddLeadNote({ mutation: { onSuccess: () => { invalidate(); setNoteBody(""); } } });
  const logAct = useLogLeadActivity({ mutation: { onSuccess: () => { invalidate(); setActSubject(""); } } });
  const convert = useConvertLeadToQuote({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        setConvertOpen(false);
        toast({ title: "Converted", description: `Quote ${data.quote.number} created` });
        setLocation(`/quotes/${data.quote.id}`);
      },
      onError: (e: Error) => toast({ title: "Conversion failed", description: e.message, variant: "destructive" }),
    },
  });
  const lose = useLoseLead({
    mutation: {
      onSuccess: () => { invalidate(); setLoseOpen(false); toast({ title: "Lead marked lost" }); },
    },
  });
  const del = useDeleteLead({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); setLocation("/leads"); },
    },
  });
  const addFile = useAddLeadFile({
    mutation: {
      onSuccess: () => { invalidate(); setFileName(""); setFileUrl(""); },
      onError: (e: Error) => toast({ title: "Could not attach file", description: e.message, variant: "destructive" }),
    },
  });
  const delFile = useDeleteLeadFile({
    mutation: { onSuccess: invalidate },
  });

  if (isLoading || !lead) {
    return <div className="space-y-6 max-w-5xl mx-auto"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  function handleStatus(status: string) {
    update.mutate({ leadId, data: { status: status as any } });
  }

  function handleConvertSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pounds = parseFloat(String(fd.get("value") ?? ""));
    convert.mutate({
      leadId,
      data: {
        quoteTitle: (fd.get("quoteTitle") as string) || undefined,
        valuePence: Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : undefined,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/leads" className="inline-flex items-center gap-2 text-sm uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All leads
        </Link>
        <div className="flex gap-2">
          {lead.status !== "won" && lead.status !== "lost" && (
            <>
              <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-convert-lead">
                    <ArrowRight className="h-4 w-4 mr-2" /> Convert to quote
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none">
                  <DialogHeader><DialogTitle className="uppercase tracking-tighter">Convert lead</DialogTitle></DialogHeader>
                  <form onSubmit={handleConvertSubmit} className="space-y-3">
                    <div><Label>Quote title</Label><Input name="quoteTitle" defaultValue={lead.title ?? `Quote for ${lead.name}`} /></div>
                    <div><Label>Estimated value (£)</Label><Input name="value" type="number" step="0.01" defaultValue={lead.valuePence > 0 ? (lead.valuePence / 100).toFixed(2) : ""} /></div>
                    <p className="text-xs text-muted-foreground">A customer record will be reused if their email matches, otherwise created.</p>
                    <DialogFooter>
                      <Button type="submit" disabled={convert.isPending} className="rounded-none uppercase tracking-wider font-bold">
                        {convert.isPending ? "Working…" : "Create quote"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={loseOpen} onOpenChange={setLoseOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-lose-lead">
                    <XCircle className="h-4 w-4 mr-2" /> Mark lost
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none">
                  <DialogHeader><DialogTitle className="uppercase tracking-tighter">Mark lead lost</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Reason</Label><Textarea value={loseReason} onChange={(e) => setLoseReason(e.target.value)} rows={3} /></div>
                    <DialogFooter>
                      <Button onClick={() => lose.mutate({ leadId, data: { reason: loseReason || undefined } })} disabled={lose.isPending} className="rounded-none uppercase tracking-wider font-bold">
                        {lose.isPending ? "Saving…" : "Confirm"}
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button variant="ghost" size="icon" className="rounded-none" onClick={() => { if (confirm("Delete this lead?")) del.mutate({ leadId }); }} data-testid="button-delete-lead">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl uppercase tracking-tighter">{lead.name}</CardTitle>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="rounded-none uppercase tracking-wider text-[10px] font-bold">{lead.source}</Badge>
                <Badge className="rounded-none uppercase tracking-wider text-[10px] font-bold">{lead.status}</Badge>
                <Badge variant="secondary" className="rounded-none uppercase tracking-wider text-[10px] font-bold">Score {lead.score}/100</Badge>
                {lead.convertedQuoteId && (
                  <Link href={`/quotes/${lead.convertedQuoteId}`}>
                    <Badge variant="outline" className="rounded-none uppercase tracking-wider text-[10px] font-bold hover:bg-muted cursor-pointer">View quote</Badge>
                  </Link>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Est. value</div>
              <div className="text-2xl font-bold font-mono">{lead.valuePence > 0 ? fmtGbp(lead.valuePence) : "—"}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email ?? "—"}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{lead.phone ?? "—"}</div>
            <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" />{lead.company ?? "—"}</div>
          </div>
          {lead.title && <div className="text-sm"><span className="text-muted-foreground uppercase tracking-wider text-xs mr-2">Need:</span>{lead.title}</div>}
          {lead.message && <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 border border-border">{lead.message}</div>}
          {lead.lostReason && <div className="text-sm"><span className="text-destructive uppercase tracking-wider text-xs font-bold mr-2">Lost reason:</span>{lead.lostReason}</div>}
          {lead.followUpDueAt && lead.status !== "won" && lead.status !== "lost" && (
            <div className={`text-sm flex items-center gap-2 ${lead.followUpOverdue ? "text-destructive font-bold" : "text-muted-foreground"}`}>
              <Clock className="h-4 w-4" /> Follow-up due {new Date(lead.followUpDueAt).toLocaleString("en-GB")}
            </div>
          )}

          {lead.status !== "won" && lead.status !== "lost" && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground self-center">Move to:</Label>
              {(["new", "contacted", "qualified"] as const).filter((s) => s !== lead.status).map((s) => (
                <Button key={s} size="sm" variant="outline" className="rounded-none uppercase tracking-wider text-xs font-bold" onClick={() => handleStatus(s)} data-testid={`status-${s}`}>
                  {s}
                </Button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assignee:</Label>
            <Select
              value={lead.ownerUserId ?? "__unassigned__"}
              onValueChange={(v) =>
                update.mutate({
                  leadId,
                  data: { ownerUserId: v === "__unassigned__" ? null : v },
                })
              }
            >
              <SelectTrigger className="rounded-none w-64" data-testid="select-lead-owner">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(team?.members ?? []).map((m: any) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className=" border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2"><StickyNote className="h-5 w-5" /> Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note…" rows={2} data-testid="input-lead-note" />
              <Button onClick={() => addNote.mutate({ leadId, data: { body: noteBody } })} disabled={!noteBody.trim() || addNote.isPending} className="rounded-none uppercase tracking-wider text-xs font-bold">
                Add
              </Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {lead.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes.</p>
              ) : lead.notes.map((n) => (
                <div key={n.id} className="text-sm border border-border p-3 bg-background">
                  <div className="whitespace-pre-wrap">{n.body}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {n.authorLabel ?? "Someone"} · {new Date(n.createdAt).toLocaleString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className=" border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="w-32">
                <Select value={actKind} onValueChange={setActKind}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input value={actSubject} onChange={(e) => setActSubject(e.target.value)} placeholder="Brief summary" className="flex-1" />
              <Button onClick={() => logAct.mutate({ leadId, data: { kind: actKind as any, subject: actSubject || undefined } })} disabled={!actSubject.trim() || logAct.isPending} className="rounded-none uppercase tracking-wider text-xs font-bold">
                Log
              </Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : lead.activities.map((a) => (
                <div key={a.id} className="text-sm border border-border p-3 bg-background">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-none uppercase tracking-wider text-[10px] font-bold">{a.kind}</Badge>
                    <span className="font-medium">{a.subject ?? ""}</span>
                  </div>
                  {a.body && <div className="whitespace-pre-wrap mt-1">{a.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.actorLabel ?? "Someone"} · {new Date(a.occurredAt).toLocaleString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className=" border-border shadow-sm" data-testid="card-lead-files">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2"><Paperclip className="h-5 w-5" /> Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File label (e.g. Site photo)" className="rounded-none" data-testid="input-file-name" />
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://… (link to PDF, image, drive, etc.)" className="rounded-none" data-testid="input-file-url" />
            <Button
              onClick={() => addFile.mutate({ leadId, data: { name: fileName.trim(), url: fileUrl.trim() } })}
              disabled={!fileName.trim() || !fileUrl.trim() || addFile.isPending}
              className="rounded-none uppercase tracking-wider text-xs font-bold"
              data-testid="button-add-file"
            >
              Attach
            </Button>
          </div>
          {lead.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files attached.</p>
          ) : (
            <div className="space-y-2">
              {lead.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm border border-border p-3 bg-background">
                  <div className="min-w-0 flex-1">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium hover:underline">
                      <ExternalLink className="h-4 w-4" /> <span className="truncate">{f.name}</span>
                    </a>
                    <div className="text-xs text-muted-foreground mt-1">
                      {f.uploadedByLabel ?? "Someone"} · {new Date(f.createdAt).toLocaleString("en-GB")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-none"
                    onClick={() => { if (confirm(`Remove "${f.name}"?`)) delFile.mutate({ leadId, fileId: f.id }); }}
                    data-testid={`button-delete-file-${f.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
