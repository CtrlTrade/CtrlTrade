import { useGetReportQuoteConversion, useGetAdminReportQuoteConversion } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp, KpiRow } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function QuoteConversionReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportQuoteConversion(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportQuoteConversion(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Quote Conversion"
      description="Sent vs accepted vs converted-to-job."
      range={range}
      onChange={setRange}
      exportRows={
        data?.timeline.map((t) => ({ date: t.bucket, sent: t.sent, accepted: t.accepted, converted: t.converted })) ?? []
      }
      exportFilename={`quote-conversion-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Draft", value: String(data.draft) },
              { label: "Sent", value: String(data.sent + data.accepted + data.declined + data.converted) },
              { label: "Accept rate", value: `${data.acceptRatePct}%` },
              { label: "Conversion rate", value: `${data.conversionRatePct}%` },
            ]}
          />
          <KpiRow
            items={[
              { label: "Sent value", value: fmtGbp(data.sentValuePence) },
              { label: "Accepted value", value: fmtGbp(data.acceptedValuePence) },
              { label: "Converted value", value: fmtGbp(data.convertedValuePence) },
              { label: "Declined", value: String(data.declined) },
            ]}
          />
          <Card className=" border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight text-sm">Funnel over time</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.timeline.map((t) => ({ date: t.bucket, Sent: t.sent, Accepted: t.accepted, Converted: t.converted }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Sent" fill="#94a3b8" />
                    <Bar dataKey="Accepted" fill="hsl(var(--primary))" />
                    <Bar dataKey="Converted" fill="#22c55e" />
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
