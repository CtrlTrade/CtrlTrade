import { useState } from "react";
import {
  useListTimesheets,
  useListTeam,
  useApproveTimesheetEntry,
  useRejectTimesheetEntry,
  useSubmitTimesheetEntry,
  getListTimesheetsQueryKey,
} from "@workspace/api-client-react";
import type { TimesheetEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CheckCircle2, XCircle, Clock3, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function fmtHours(hours: number | null | undefined): string {
  if (!hours) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 13);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-mono text-[10px] uppercase tracking-wide"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    case "submitted":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono text-[10px] uppercase tracking-wide"><Clock3 className="h-3 w-3 mr-1" />Pending</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-mono text-[10px] uppercase tracking-wide"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
  }
}

interface RejectDialogProps {
  entry: TimesheetEntry | null;
  onClose: () => void;
  onReject: (id: string, reason: string) => void;
  isLoading: boolean;
}

function RejectDialog({ entry, onClose, onReject, isLoading }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tighter">Reject Timesheet Entry</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase tracking-wide">Reason for rejection</Label>
          <Textarea
            className="mt-1 rounded-none resize-none"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter a reason..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none uppercase text-xs tracking-wide" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-none uppercase text-xs tracking-wide"
            disabled={!reason.trim() || isLoading}
            onClick={() => entry && onReject(entry.id, reason)}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EntryRowProps {
  entry: TimesheetEntry;
  canManage: boolean;
  onApprove: (id: string) => void;
  onRejectClick: (entry: TimesheetEntry) => void;
  onSubmit: (id: string) => void;
  isProcessing: boolean;
}

function EntryRow({ entry, canManage, onApprove, onRejectClick, onSubmit, isProcessing }: EntryRowProps) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
            {entry.userName ?? "Unknown"}
          </span>
          {entry.jobNumber && (
            <span className="font-mono text-[10px] text-muted-foreground">#{entry.jobNumber}</span>
          )}
          {statusBadge(entry.status)}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
          <span><Clock className="h-3 w-3 inline mr-0.5" />{fmtHours(entry.hoursWorked)}</span>
          {entry.travelMinutes > 0 && <span>Travel {entry.travelMinutes}m</span>}
          {entry.mileageMiles > 0 && <span>{entry.mileageMiles} mi</span>}
        </div>
        {entry.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>
        )}
        {entry.status === "rejected" && entry.rejectionReason && (
          <p className="text-xs text-red-600 mt-0.5">
            <XCircle className="h-3 w-3 inline mr-0.5" />
            {entry.rejectionReason}
          </p>
        )}
        {entry.status === "approved" && entry.approvedByName && (
          <p className="text-[10px] text-emerald-600 mt-0.5">
            Approved by {entry.approvedByName}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="font-mono font-bold text-sm">{fmtHours(entry.hoursWorked)}</span>
        {(entry.status === "draft" || entry.status === "rejected") && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-none uppercase text-[10px] tracking-wide h-6 px-2"
            disabled={isProcessing}
            onClick={() => onSubmit(entry.id)}
          >
            Submit
          </Button>
        )}
        {canManage && entry.status === "submitted" && (
          <div className="flex gap-1">
            <Button
              size="sm"
              className="rounded-none uppercase text-[10px] tracking-wide h-6 px-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={isProcessing}
              onClick={() => onApprove(entry.id)}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none uppercase text-[10px] tracking-wide h-6 px-2 border-red-500 text-red-600 hover:bg-red-50"
              disabled={isProcessing}
              onClick={() => onRejectClick(entry)}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DayGroupProps {
  date: string;
  entries: TimesheetEntry[];
  canManage: boolean;
  onApprove: (id: string) => void;
  onRejectClick: (entry: TimesheetEntry) => void;
  onSubmit: (id: string) => void;
  isProcessing: boolean;
}

function DayGroup({ date, entries, canManage, onApprove, onRejectClick, onSubmit, isProcessing }: DayGroupProps) {
  const totalHours = entries
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);
  const pendingCount = entries.filter((e) => e.status === "submitted").length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="uppercase tracking-tight text-sm">{fmtDate(date)}</CardTitle>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono text-[10px]">
                {pendingCount} pending
              </Badge>
            )}
            {totalHours > 0 && (
              <Badge variant="outline" className="font-mono text-xs uppercase">
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                {fmtHours(totalHours)} approved
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            canManage={canManage}
            onApprove={onApprove}
            onRejectClick={onRejectClick}
            onSubmit={onSubmit}
            isProcessing={isProcessing}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function AppTimesheets() {
  const defaults = getDefaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [userId, setUserId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rejectTarget, setRejectTarget] = useState<TimesheetEntry | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: team } = useListTeam();
  const { data, isLoading } = useListTimesheets(
    {
      from,
      to,
      ...(userId !== "all" ? { userId } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    },
    { query: { keepPreviousData: true } as any },
  );

  const approveMutation = useApproveTimesheetEntry();
  const rejectMutation = useRejectTimesheetEntry();
  const submitMutation = useSubmitTimesheetEntry();

  const entries = data ?? [];

  const myMember = team?.members?.find((m) => m.isYou);
  const canManage = ["owner", "admin", "manager"].includes(myMember?.role ?? "");

  // Group by date
  const grouped = new Map<string, TimesheetEntry[]>();
  for (const e of entries) {
    const d = e.date.slice(0, 10);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(e);
  }
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a));

  const approvedHours = entries
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListTimesheetsQueryKey() });
  }

  function markProcessing(id: string, done: boolean) {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      done ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleApprove(id: string) {
    markProcessing(id, false);
    approveMutation.mutate(
      { entryId: id },
      {
        onSuccess: () => { invalidate(); markProcessing(id, true); toast({ title: "Entry approved" }); },
        onError: (e: any) => { markProcessing(id, true); toast({ title: "Failed to approve", description: e?.message, variant: "destructive" }); },
      },
    );
  }

  function handleReject(id: string, reason: string) {
    markProcessing(id, false);
    rejectMutation.mutate(
      { entryId: id, data: { reason } },
      {
        onSuccess: () => { invalidate(); markProcessing(id, true); setRejectTarget(null); toast({ title: "Entry rejected" }); },
        onError: (e: any) => { markProcessing(id, true); toast({ title: "Failed to reject", description: e?.message, variant: "destructive" }); },
      },
    );
  }

  function handleSubmit(id: string) {
    markProcessing(id, false);
    submitMutation.mutate(
      { entryId: id },
      {
        onSuccess: () => { invalidate(); markProcessing(id, true); toast({ title: "Entry submitted for approval" }); },
        onError: (e: any) => { markProcessing(id, true); toast({ title: "Failed to submit", description: e?.message, variant: "destructive" }); },
      },
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Timesheets</h2>
        <p className="text-sm text-muted-foreground">Field staff time entries — submit, review, and approve.</p>
      </div>

      <Card className="border-border">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wide">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-none" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-none" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide">Staff member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {(team?.members ?? []).map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Pending approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pb-1">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Approved hours</div>
              <div className="text-2xl font-bold font-mono" data-testid="text-total-hours">
                {fmtHours(approvedHours)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : sortedDates.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No timesheet entries found for the selected period.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <DayGroup
              key={date}
              date={date}
              entries={grouped.get(date)!}
              canManage={canManage}
              onApprove={handleApprove}
              onRejectClick={setRejectTarget}
              onSubmit={handleSubmit}
              isProcessing={processingIds.size > 0}
            />
          ))}
        </div>
      )}

      <RejectDialog
        entry={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={handleReject}
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
}
