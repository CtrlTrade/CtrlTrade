import { useGetReportRevenue, useGetAdminReportRevenue } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp, KpiRow } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";

export function RevenueReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportRevenue(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportRevenue(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Revenue"
      description="Invoiced vs collected over time, with monthly totals."
      range={range}
      onChange={setRange}
      exportRows={
        data?.timeline.map((p) => ({
          date: p.bucket,
          invoiced_pence: p.invoicedPence,
          collected_pence: p.collectedPence,
        })) ?? []
      }
      exportFilename={`revenue-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Invoiced", value: fmtGbp(data.totalInvoicedPence) },
              { label: "Collected", value: fmtGbp(data.totalCollectedPence) },
              { label: "Outstanding", value: fmtGbp(data.outstandingPence) },
              {
                label: "Collection %",
                value:
                  data.totalInvoicedPence > 0
                    ? `${Math.round((data.totalCollectedPence / data.totalInvoicedPence) * 100)}%`
                    : "—",
              },
            ]}
          />
          <Card className=" border-border">
            <CardHeader>
              <CardTitle className=" text-sm">Daily timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={data.timeline.map((p) => ({
                      date: p.bucket,
                      Invoiced: p.invoicedPence / 100,
                      Collected: p.collectedPence / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="Invoiced" stroke="hsl(var(--primary))" />
                    <Line type="monotone" dataKey="Collected" stroke="#22c55e" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className=" border-border">
            <CardHeader>
              <CardTitle className=" text-sm">By month</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.byMonth.map((p) => ({
                      month: p.bucket,
                      Invoiced: p.invoicedPence / 100,
                      Collected: p.collectedPence / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `£${Number(v).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="Invoiced" fill="hsl(var(--primary))" />
                    <Bar dataKey="Collected" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </ReportShell>
  );
}
