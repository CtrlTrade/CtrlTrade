import { useGetReportEngineerPerformance, useGetAdminReportEngineerPerformance } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp } from "./shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function EngineerPerformanceReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportEngineerPerformance(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportEngineerPerformance(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Engineer Performance"
      description="Jobs completed, hours, value and on-time %."
      range={range}
      onChange={setRange}
      exportRows={
        data?.rows.map((r) => ({
          name: r.name,
          jobs_completed: r.jobsCompleted,
          jobs_total: r.jobsTotal,
          hours: r.hours,
          total_value_pence: r.totalValuePence,
          on_time_pct: r.onTimePct,
        })) ?? []
      }
      exportFilename={`engineer-performance-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className="rounded-none border-border">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3">Engineer</th>
                  <th className="p-3 text-right">Completed</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Hours</th>
                  <th className="p-3 text-right">Value</th>
                  <th className="p-3 text-right">On-time %</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td className="p-6 text-muted-foreground" colSpan={6}>No jobs in this period.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.userId ?? "unassigned"} className="border-t border-border">
                    <td className="p-3 font-bold">{r.name}</td>
                    <td className="p-3 text-right font-mono">{r.jobsCompleted}</td>
                    <td className="p-3 text-right font-mono">{r.jobsTotal}</td>
                    <td className="p-3 text-right font-mono">{r.hours}</td>
                    <td className="p-3 text-right font-mono">{fmtGbp(r.totalValuePence)}</td>
                    <td className="p-3 text-right font-mono">{r.onTimePct}%</td>
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
