import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useGetSchedule } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, AlertTriangle } from "lucide-react";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function AppSchedule() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const from = anchor;
  const to = useMemo(() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); return d; }, [anchor]);

  const { data, isLoading } = useGetSchedule({ from: from.toISOString(), to: to.toISOString() });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor); d.setDate(d.getDate() + i); return d;
  }), [anchor]);

  const byDay = useMemo(() => {
    const map: Record<string, typeof data> = {};
    days.forEach((d) => { map[d.toDateString()] = [] as never; });
    (data ?? []).forEach((e) => {
      const k = new Date(e.start).toDateString();
      if (map[k]) (map[k] as unknown as Array<typeof e>).push(e);
    });
    return map;
  }, [data, days]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter flex items-center gap-2">
          <CalIcon className="h-7 w-7" /> Schedule
        </h1>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="icon" className="rounded-none" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); }}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-mono text-sm">{from.toLocaleDateString()} – {new Date(to.getTime() - 1).toLocaleDateString()}</span>
          <Button variant="outline" size="icon" className="rounded-none" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); }}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const events = (byDay[d.toDateString()] as unknown as Array<NonNullable<typeof data>[number]>) ?? [];
            return (
              <Card key={d.toISOString()} className=" border-border shadow-sm min-h-[200px]">
                <CardHeader className="pb-2">
                  <CardTitle className="uppercase tracking-tight text-xs">
                    {d.toLocaleDateString(undefined, { weekday: "short" })} {d.getDate()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-2">
                  {events.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  {events.map((e) => (
                    <Link key={e.jobId} href={`/app/jobs/${e.jobId}`}>
                      <div className="border border-border p-2 hover:bg-accent cursor-pointer" data-testid={`event-${e.jobId}`}>
                        <div className="font-mono text-xs">{new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="text-xs font-bold truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{e.customerName}</div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {e.assignedUserName && <Badge variant="outline" className="rounded-none text-[10px]">{e.assignedUserName}</Badge>}
                          {e.assignedUserConflict && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="rounded-none text-[10px] gap-1 cursor-default" data-testid={`badge-conflict-${e.jobId}`}>
                                  <AlertTriangle className="h-2.5 w-2.5" /> Unavailable
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {e.assignedUserName ?? "Assigned staff"} has an availability block on this day.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
