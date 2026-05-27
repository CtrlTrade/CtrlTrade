import { useGetReportCustomerLtv, useGetAdminReportCustomerLtv } from "@workspace/api-client-react";
import { useDateRange, ReportShell, fmtGbp } from "./shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerLtvReport({ admin = false }: { admin?: boolean }) {
  const [range, setRange] = useDateRange();
  const params = { from: range.from.toISOString(), to: range.to.toISOString() };
  const tenantQ = useGetReportCustomerLtv(params, { query: { enabled: !admin } as any });
  const adminQ = useGetAdminReportCustomerLtv(params, { query: { enabled: admin } as any });
  const { data, isLoading } = admin ? adminQ : tenantQ;

  return (
    <ReportShell
      title="Customer Lifetime Value"
      description="Total invoiced and collected per customer in the selected period."
      range={range}
      onChange={setRange}
      exportRows={
        data?.rows.map((r) => ({
          customer: r.name,
          invoices: r.invoiceCount,
          invoiced_pence: r.totalInvoicedPence,
          collected_pence: r.totalCollectedPence,
          first_invoice_at: r.firstInvoiceAt ?? "",
          last_invoice_at: r.lastInvoiceAt ?? "",
        })) ?? []
      }
      exportFilename={`customer-ltv-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className=" border-border">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Invoices</th>
                  <th className="p-3 text-right">Invoiced</th>
                  <th className="p-3 text-right">Collected</th>
                  <th className="p-3">First</th>
                  <th className="p-3">Last</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td className="p-6 text-muted-foreground" colSpan={6}>No invoices in this period.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.customerId} className="border-t border-border">
                    <td className="p-3 font-bold">{r.name}</td>
                    <td className="p-3 text-right font-mono">{r.invoiceCount}</td>
                    <td className="p-3 text-right font-mono">{fmtGbp(r.totalInvoicedPence)}</td>
                    <td className="p-3 text-right font-mono">{fmtGbp(r.totalCollectedPence)}</td>
                    <td className="p-3 font-mono text-xs">{r.firstInvoiceAt ? new Date(r.firstInvoiceAt).toLocaleDateString() : "—"}</td>
                    <td className="p-3 font-mono text-xs">{r.lastInvoiceAt ? new Date(r.lastInvoiceAt).toLocaleDateString() : "—"}</td>
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
