import { useGetReportAgedDebtors, useGetAdminReportAgedDebtors } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp, KpiRow } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function AgedDebtorsReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportAgedDebtors(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportAgedDebtors(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Aged Debtors"
      description="Outstanding invoices bucketed by overdue age."
      range={range}
      onChange={setRange}
      exportRows={
        data?.rows.map((r) => ({
          number: r.number,
          customer: r.customerName,
          due_at: r.dueAt ?? "",
          outstanding_pence: r.outstandingPence,
          days_overdue: r.daysOverdue,
        })) ?? []
      }
      exportFilename={`aged-debtors-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Total outstanding", value: fmtGbp(data.totalOutstandingPence) },
              ...data.buckets.map((b) => ({
                label: b.label,
                value: fmtGbp(b.totalPence),
              })),
            ].slice(0, 4)}
          />
          <Card className=" border-border">
            <CardHeader>
              <CardTitle className=" text-sm">Outstanding by bucket</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.buckets.map((b) => ({
                      bucket: b.label,
                      value: b.totalPence / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className=" border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left text-[10px] font-semibold">
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Due</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3 text-right">Days overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr><td className="p-6 text-muted-foreground" colSpan={5}>No outstanding invoices.</td></tr>
                  )}
                  {data.rows.map((r) => (
                    <tr key={r.invoiceId} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{r.number}</td>
                      <td className="p-3">{r.customerName}</td>
                      <td className="p-3 font-mono text-xs">{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : "—"}</td>
                      <td className="p-3 text-right font-mono">{fmtGbp(r.outstandingPence)}</td>
                      <td className="p-3 text-right font-mono">{r.daysOverdue}</td>
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
