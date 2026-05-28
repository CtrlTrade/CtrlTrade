import { useGetReportActivityHeatmap, useGetAdminReportActivityHeatmap } from "@workspace/api-client-react";
import { useDateRange, ReportShell } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ActivityHeatmapReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportActivityHeatmap(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportActivityHeatmap(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  if (data) {
    for (const c of data.cells) {
      grid[c.dayOfWeek][c.hour] = c.jobCount;
      if (c.jobCount > max) max = c.jobCount;
    }
  }

  return (
    <ReportShell
      title="Activity Heatmap"
      description="Jobs scheduled per day of week × hour of day."
      range={range}
      onChange={setRange}
      exportRows={
        data?.cells.map((c) => ({ day_of_week: c.dayOfWeek, hour: c.hour, count: c.jobCount })) ?? []
      }
      exportFilename={`activity-heatmap-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className=" border-border">
          <CardHeader>
            <CardTitle className=" text-sm">Jobs scheduled (total: {data.totalJobs})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <th key={h} className="px-1 text-[10px] font-mono text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d, di) => (
                  <tr key={d}>
                    <td className="text-[10px] font-semibold pr-2">{d}</td>
                    {grid[di].map((v, hi) => {
                      const intensity = max > 0 ? v / max : 0;
                      const bg = v === 0 ? "transparent" : `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`;
                      return (
                        <td
                          key={hi}
                          className="w-7 h-7 text-center text-[10px] font-mono border border-border"
                          style={{ backgroundColor: bg, color: intensity > 0.5 ? "white" : undefined }}
                          title={`${d} ${hi}:00 — ${v} jobs`}
                          data-testid={`heatmap-${di}-${hi}`}
                        >
                          {v > 0 ? v : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </ReportShell>
  );
}
