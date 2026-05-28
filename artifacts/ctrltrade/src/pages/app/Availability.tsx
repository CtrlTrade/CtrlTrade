import { useState, useMemo } from "react";
import {
  useListStaffAvailability,
  useCreateStaffAvailability,
  useDeleteStaffAvailability,
  useListTeam,
  useGetSession,
} from "@workspace/api-client-react";
import type { StaffAvailabilityEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REASONS = [
  { value: "holiday", label: "Holiday", color: "bg-blue-500" },
  { value: "sick", label: "Sickness", color: "bg-red-500" },
  { value: "training", label: "Training", color: "bg-amber-500" },
  { value: "other", label: "Other", color: "bg-slate-500" },
];

function getReasonColor(reason: string): string {
  return REASONS.find((r) => r.value === reason)?.color ?? "bg-slate-500";
}

function getReasonLabel(reason: string): string {
  return REASONS.find((r) => r.value === reason)?.label ?? reason;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  teamMembers: Array<{ userId: string; name?: string | null; email: string }>;
  currentUserId: string;
  currentUserRole: string;
  onCreated: () => void;
}

function AddModal({ open, onClose, teamMembers, currentUserId, currentUserRole, onCreated }: AddModalProps) {
  const canManageOthers = ["owner", "admin", "manager"].includes(currentUserRole);
  const [userId, setUserId] = useState(currentUserId);
  const [startDate, setStartDate] = useState(fmtDate(new Date()));
  const [endDate, setEndDate] = useState(fmtDate(new Date()));
  const [reason, setReason] = useState("holiday");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const create = useCreateStaffAvailability({
    mutation: {
      onSuccess: () => {
        toast({ title: "Availability block added" });
        onCreated();
        onClose();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to create", variant: "destructive" });
      },
    },
  });

  const handleSubmit = () => {
    create.mutate({ data: { userId, startDate, endDate, reason, notes: notes || null } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold">Add Unavailability</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {canManageOthers && (
            <div className="space-y-1">
              <Label className="text-xs ">Staff Member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name ?? m.email}
                      {m.userId === currentUserId && " (you)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs ">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs ">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs ">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs ">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl text-sm" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="rounded-xl font-bold"
            onClick={handleSubmit}
            disabled={create.isPending || !startDate || !endDate || startDate > endDate}
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppAvailability() {
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const totalDays = daysInMonth(year, month);

  const fromStr = fmtDate(new Date(year, month, 1));
  const toStr = fmtDate(new Date(year, month, totalDays));

  const { data: availData, isLoading } = useListStaffAvailability({ from: fromStr, to: toStr });
  const { data: team } = useListTeam();
  const { data: session } = useGetSession();

  const currentUserId = session?.user?.id ?? "";
  const currentUserRole = (session as any)?.membership?.role ?? session?.tenant ? "staff" : "staff";

  const members = team?.members ?? [];
  const activeMembers = members.filter((m) => m.status === "active");

  const deleteMutation = useDeleteStaffAvailability({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/v1/staff/availability"] });
        toast({ title: "Availability block removed" });
      },
      onError: () => toast({ title: "Error removing block", variant: "destructive" }),
    },
  });

  // Build a map: dateStr -> array of availability entries
  const dayMap = useMemo(() => {
    const map = new Map<string, StaffAvailabilityEntry[]>();
    for (const entry of availData ?? []) {
      const start = new Date(entry.startDate + "T12:00:00");
      const end = new Date(entry.endDate + "T12:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = fmtDate(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(entry);
      }
    }
    return map;
  }, [availData]);

  // Calendar grid: first day of month might not be Monday
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday=0
  const days = useMemo(() => {
    const arr: Array<{ date: Date; dateStr: string } | null> = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      arr.push({ date, dateStr: fmtDate(date) });
    }
    return arr;
  }, [year, month, totalDays, firstDow]);

  const prevMonth = () => setAnchor(new Date(year, month - 1, 1));
  const nextMonth = () => setAnchor(new Date(year, month + 1, 1));

  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Today's upcoming entries for this user
  const today = fmtDate(new Date());
  const myUpcoming = (availData ?? []).filter((e) => e.userId === currentUserId && e.endDate >= today);

  const canManageOthers = ["owner", "admin", "manager"].includes(currentUserRole);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CalendarX className="h-7 w-7" /> Availability
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mark blocked days so schedulers know who is available.
          </p>
        </div>
        <Button
          className="rounded-xl font-bold gap-2"
          onClick={() => setShowAdd(true)}
          data-testid="button-add-availability"
        >
          <Plus className="h-4 w-4" /> Add Block
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs  text-muted-foreground font-bold">Legend:</span>
        {REASONS.map((r) => (
          <div key={r.value} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${r.color}`} />
            <span className="text-xs">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-xl" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg min-w-48 text-center">{monthLabel}</span>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="rounded-xl font-bold text-xs"
          onClick={() => setAnchor(startOfMonth(new Date()))}
        >
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="border border-border">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-bold text-muted-foreground border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((cell, i) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[100px] border-b border-r border-border last:border-r-0 bg-muted/20"
                  />
                );
              }
              const { date, dateStr } = cell;
              const entries = dayMap.get(dateStr) ?? [];
              const isToday = dateStr === today;
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div
                  key={dateStr}
                  className={`min-h-[100px] border-b border-r border-border last:border-r-0 p-1.5 flex flex-col gap-1 ${isWeekend ? "bg-muted/30" : ""}`}
                >
                  <div className={`text-xs font-bold self-start px-1 ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {date.getDate()}
                  </div>
                  {entries.map((e) => {
                    const isFirst = e.startDate === dateStr;
                    const canDelete = canManageOthers || e.userId === currentUserId;
                    return (
                      <div
                        key={`${e.id}-${dateStr}`}
                        className={`text-[10px] text-white px-1 py-0.5 rounded-sm flex items-center justify-between gap-0.5 ${getReasonColor(e.reason)}`}
                        data-testid={`avail-cell-${e.id}`}
                      >
                        {isFirst ? (
                          <span className="truncate font-medium">{e.userName ?? "—"} · {getReasonLabel(e.reason)}</span>
                        ) : (
                          <span className="truncate opacity-70">{e.userName ?? "—"}</span>
                        )}
                        {isFirst && canDelete && (
                          <button
                            onClick={() => deleteMutation.mutate({ id: e.id })}
                            className="opacity-70 hover:opacity-100 flex-shrink-0"
                            title="Remove block"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My upcoming blocks */}
      {myUpcoming.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className=" text-sm">Your Upcoming Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myUpcoming.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-sm ${getReasonColor(e.reason)}`} />
                    <div>
                      <div className="text-sm font-medium">{getReasonLabel(e.reason)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.startDate} – {e.endDate}</div>
                      {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                    </div>
                  </div>
                  {e.endDate >= today && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-xl text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: e.id })}
                      data-testid={`button-delete-avail-${e.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        teamMembers={activeMembers}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onCreated={() => qc.invalidateQueries({ queryKey: ["/v1/staff/availability"] })}
      />
    </div>
  );
}
