import { useGetReportLeadRoi, useGetAdminReportLeadRoi } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp, KpiRow } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function LeadRoiReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportLeadRoi(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportLeadRoi(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Lead ROI"
      description="Leads by source, conversion rate, revenue attributed."
      range={range}
      onChange={setRange}
      exportRows={
        data?.rows.map((r) => ({
          source: r.source,
          total_leads: r.totalLeads,
          won_leads: r.wonLeads,
          conversion_pct: r.conversionPct,
          won_value_pence: r.wonValuePence,
          pipeline_value_pence: r.pipelineValuePence,
        })) ?? []
      }
      exportFilename={`lead-roi-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Total leads", value: String(data.totalLeads) },
              { label: "Won", value: String(data.wonLeads) },
              { label: "Won value", value: fmtGbp(data.wonValuePence) },
              { label: "Pipeline value", value: fmtGbp(data.pipelineValuePence) },
            ]}
          />
          <Card className=" border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-sm">Revenue won by source</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.rows.map((r) => ({
                      source: r.source,
                      Won: r.wonValuePence / 100,
                      Pipeline: r.pipelineValuePence / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="Won" fill="hsl(var(--primary))" />
                    <Bar dataKey="Pipeline" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className=" border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left uppercase text-[10px] tracking-wider font-bold">
                    <th className="p-3">Source</th>
                    <th className="p-3 text-right">Leads</th>
                    <th className="p-3 text-right">Won</th>
                    <th className="p-3 text-right">Conv. %</th>
                    <th className="p-3 text-right">Won value</th>
                    <th className="p-3 text-right">Pipeline value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.source} className="border-t border-border">
                      <td className="p-3 font-mono uppercase">{r.source}</td>
                      <td className="p-3 text-right font-mono">{r.totalLeads}</td>
                      <td className="p-3 text-right font-mono">{r.wonLeads}</td>
                      <td className="p-3 text-right font-mono">{r.conversionPct}%</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.wonValuePence)}</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.pipelineValuePence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </ReportShell>
  );
}
