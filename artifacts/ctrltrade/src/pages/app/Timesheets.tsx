import { useState } from "react";
import {
  useListTimesheets,
  useListTeam,
} from "@workspace/api-client-react";
import type { TimesheetEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";

function fmtDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDateHeading(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

interface CheckinRowProps {
  entry: {
    id: string;
    jobNumber?: string | null;
    jobTitle?: string | null;
    checkedInAt: string;
    checkedOutAt?: string | null;
    durationMinutes?: number | null;
    checkInLat?: string | null;
    checkInLng?: string | null;
    notes?: string | null;
  };
}

function CheckinRow({ entry }: CheckinRowProps) {
  const hasGps = !!entry.checkInLat && !!entry.checkInLng;
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold uppercase tracking-wide">
            {entry.jobNumber ?? "—"}
          </span>
          {entry.jobTitle && (
            <span className="text-sm text-muted-foreground truncate">{entry.jobTitle}</span>
          )}
          {hasGps && (
            <MapPin className="h-3 w-3 text-emerald-500 flex-shrink-0" />
          )}
        </div>
        {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
      </div>
      <div className="text-right text-xs flex-shrink-0 space-y-0.5">
        <div className="font-mono text-muted-foreground">
          {fmtTime(entry.checkedInAt)} → {entry.checkedOutAt ? fmtTime(entry.checkedOutAt) : <span className="text-amber-500 font-bold">ACTIVE</span>}
        </div>
        <div className="font-mono font-bold">{fmtDuration(entry.durationMinutes)}</div>
      </div>
    </div>
  );
}

interface DayGroupProps {
  group: TimesheetEntry;
}

function DayGroup({ group }: DayGroupProps) {
  const totalHours = Math.floor(group.totalMinutes / 60);
  const totalMins = group.totalMinutes % 60;
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="uppercase tracking-tight text-sm">{fmtDateHeading(group.date)}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{group.userName ?? "Unknown"}</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs uppercase">
            <Clock className="h-3 w-3 mr-1" />
            {totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {group.entries.map((entry) => (
          <CheckinRow key={entry.id} entry={entry} />
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

  const { data: team } = useListTeam();
  const { data, isLoading } = useListTimesheets(
    {
      from,
      to,
      ...(userId !== "all" ? { userId } : {}),
    },
  
  );

  const entries = data ?? [];

  const totalMinutes = entries.reduce((acc, e) => acc + e.totalMinutes, 0);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Timesheets</h2>
        <p className="text-sm text-muted-foreground">GPS check-ins and check-outs logged by field staff.</p>
      </div>

      <Card className="border-border">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
            <div className="pb-1">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Total hours</div>
              <div className="text-2xl font-bold font-mono" data-testid="text-total-hours">
                {totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`}
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
      ) : entries.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No timesheet entries found for the selected period.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((group) => (
            <DayGroup key={`${group.userId}:${group.date}`} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
