import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAdminLead,
  useUpdateAdminLead,
  useCreateAdminLeadMessage,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Phone, Mail, Building2, Wrench, MessageSquare, PhoneCall, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUSES = ["new", "contacted", "demo_booked", "won", "lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  demo_booked: "Demo Booked",
  won: "Won",
  lost: "Lost",
};

const STATUS_COLOURS: Record<LeadStatus, string> = {
  new: "border-blue-500 text-blue-400",
  contacted: "border-yellow-500 text-yellow-400",
  demo_booked: "border-purple-500 text-purple-400",
  won: "border-green-500 text-green-400",
  lost: "border-border text-muted-foreground",
};

const CHANNEL_LABELS: Record<string, string> = {
  note: "Note",
  email: "Email",
  call: "Call",
};

export function AdminLeadDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: lead, isLoading } = useGetAdminLead(params.id!);
  const updateMutation = useUpdateAdminLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/v1/admin/leads/${params.id}`] });
        toast({ title: "Lead updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });
  const messageMutation = useCreateAdminLeadMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/v1/admin/leads/${params.id}`] });
        setNoteText("");
        setNoteChannel("note");
        toast({ title: "Interaction logged" });
      },
      onError: () => toast({ title: "Failed to log interaction", variant: "destructive" }),
    },
  });

  const [noteText, setNoteText] = useState("");
  const [noteChannel, setNoteChannel] = useState<"note" | "email" | "call">("note");
  const [editNotes, setEditNotes] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-card" />
        <Skeleton className="h-64 bg-card" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20 text-muted-foreground font-mono">Lead not found.</div>
    );
  }

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ leadId: params.id!, data: { status: newStatus } });
  };

  const handleLogInteraction = () => {
    if (!noteText.trim()) return;
    messageMutation.mutate({
      leadId: params.id!,
      data: { body: noteText.trim(), channel: noteChannel, direction: "out" },
    });
  };

  const handleSaveNotes = () => {
    if (editNotes === null) return;
    updateMutation.mutate({ leadId: params.id!, data: { notes: editNotes } });
    setNotesOpen(false);
    setEditNotes(null);
  };

  const currentStatus = lead.status as LeadStatus;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground/90 uppercase text-xs font-bold"
          onClick={() => setLocation("/leads")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <Card className="rounded-xl border-border bg-black shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">{lead.name}</CardTitle>
                  {lead.company && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {lead.company}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground font-mono">{new Date(lead.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground uppercase mt-0.5">{lead.source}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="text-foreground/80 hover:text-red-500 transition-colors font-mono text-xs">
                    {lead.email}
                  </a>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="text-foreground/80 hover:text-red-500 transition-colors font-mono text-xs">
                      {lead.phone}
                    </a>
                  </div>
                )}
                {lead.trade && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{lead.trade}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-black shadow-none">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-muted-foreground">Notes</CardTitle>
              {!notesOpen ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs uppercase text-muted-foreground hover:text-foreground/90"
                  onClick={() => { setNotesOpen(true); setEditNotes(lead.notes ?? ""); }}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => { setNotesOpen(false); setEditNotes(null); }}>Cancel</Button>
                  <Button size="sm" className="text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl" onClick={handleSaveNotes}>Save</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {notesOpen ? (
                <Textarea
                  className="bg-background border-border text-foreground resize-none rounded-xl text-sm min-h-[100px]"
                  value={editNotes ?? ""}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                  {lead.notes || <span className="text-muted-foreground italic">No notes yet.</span>}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-black shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground">Log Interaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {(["note", "email", "call"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setNoteChannel(ch)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors flex items-center gap-1.5 ${
                      noteChannel === ch
                        ? "border-red-500 text-red-500 bg-red-500/10"
                        : "border-border text-muted-foreground hover:border-border"
                    }`}
                  >
                    {ch === "note" && <MessageSquare className="h-3 w-3" />}
                    {ch === "email" && <Mail className="h-3 w-3" />}
                    {ch === "call" && <PhoneCall className="h-3 w-3" />}
                    {CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
              <Textarea
                className="bg-background border-border text-foreground resize-none rounded-xl text-sm"
                placeholder={
                  noteChannel === "note"
                    ? "Add a note…"
                    : noteChannel === "email"
                    ? "Log email sent…"
                    : "Log call notes…"
                }
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <Button
                size="sm"
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white uppercase text-xs font-bold gap-2"
                onClick={handleLogInteraction}
                disabled={!noteText.trim() || messageMutation.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                {messageMutation.isPending ? "Logging…" : "Log"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-black shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground">
                Outreach Thread ({lead.messages?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!lead.messages || lead.messages.length === 0) ? (
                <div className="py-6 text-center text-muted-foreground font-mono text-xs">No interactions yet.</div>
              ) : (
                <div className="space-y-3">
                  {lead.messages.map((msg: any) => (
                    <div key={msg.id} className="border-l-2 border-border pl-3 py-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          {CHANNEL_LABELS[msg.channel] ?? msg.channel}
                        </span>
                        {msg.authorName && (
                          <span className="text-xs text-muted-foreground">by {msg.authorName}</span>
                        )}
                        <span className="text-xs text-border font-mono ml-auto">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-full md:w-56 space-y-4">
          <Card className="rounded-xl border-border bg-black shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground">Pipeline Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {STATUSES.map((s) => {
                const active = currentStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => !active && handleStatusChange(s)}
                    disabled={updateMutation.isPending}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase border transition-colors ${
                      active
                        ? `border-current bg-current/10 ${STATUS_COLOURS[s]}`
                        : "border-border text-muted-foreground hover:border-border"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
