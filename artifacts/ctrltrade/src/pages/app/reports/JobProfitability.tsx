import { useGetReportJobProfitability, useGetAdminReportJobProfitability } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp, KpiRow } from "./shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function JobProfitabilityReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportJobProfitability(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportJobProfitability(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Job Profitability"
      description="Revenue, cost and margin per job. Jobs with actual cost entries show real margin; others use a 60% margin estimate."
      range={range}
      onChange={setRange}
      exportRows={
        data?.rows.map((r) => ({
          number: r.number,
          title: r.title,
          customer: r.customerName,
          revenue_pence: r.revenuePence,
          cost_pence: r.costPence,
          margin_pence: r.marginPence,
          margin_pct: r.marginPct,
          has_actual_costs: (r as any).hasActualCosts ? "yes" : "no",
        })) ?? []
      }
      exportFilename={`job-profitability-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Revenue", value: fmtGbp(data.totalRevenuePence) },
              { label: "Actual/Est. Cost", value: fmtGbp(data.totalCostPence) },
              { label: "Margin", value: fmtGbp(data.totalMarginPence) },
              { label: "Margin %", value: `${data.marginPct}%` },
            ]}
          />
          <Card className=" border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left uppercase text-[10px] tracking-wider font-bold">
                    <th className="p-3">Job</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">Cost</th>
                    <th className="p-3 text-right">Margin</th>
                    <th className="p-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr><td className="p-6 text-muted-foreground" colSpan={6}>No jobs in this period.</td></tr>
                  )}
                  {data.rows.map((r) => (
                    <tr key={r.jobId} className="border-t border-border">
                      <td className="p-3">
                        <span className="font-mono text-xs text-muted-foreground">{r.number}</span>{" "}
                        {r.title}
                        {!(r as any).hasActualCosts && (
                          <span className="ml-2 text-[10px] text-amber-600 uppercase font-bold border border-amber-300 px-1 rounded">est.</span>
                        )}
                      </td>
                      <td className="p-3">{r.customerName ?? "—"}</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.revenuePence)}</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.costPence)}</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.marginPence)}</td>
                      <td className={`p-3 text-right font-mono ${r.marginPct < 0 ? "text-red-600" : ""}`}>{r.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">
            Jobs tagged <span className="text-amber-600 font-bold uppercase">est.</span> use a 60% gross margin estimate — add cost entries on those jobs to see real margin.
          </p>
        </>
      )}
    </ReportShell>
  );
}
