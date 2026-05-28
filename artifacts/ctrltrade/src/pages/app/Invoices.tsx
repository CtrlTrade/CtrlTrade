import { useState } from "react";
import { Link } from "wouter";
import {
  useListInvoices,
  useGetAgedDebtors,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Repeat } from "lucide-react";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export function AppInvoices() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useListInvoices(statusFilter ? { status: statusFilter } : undefined);
  const { data: debtors } = useGetAgedDebtors();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
        <Link href="/invoice-templates">
          <Button variant="outline" className="rounded-xl font-bold" data-testid="link-invoice-templates">
            <Repeat className="h-4 w-4 mr-2" /> Recurring templates
          </Button>
        </Link>
      </div>

      {debtors && (
        <Card className=" border-border shadow-sm">
          <CardHeader>
            <CardTitle className="">Aged debtors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-sm">
              <div><div className="text-muted-foreground text-xs">Current</div><div className="font-mono font-bold">{formatGBP(debtors.totals.currentPence)}</div></div>
              <div><div className="text-muted-foreground text-xs">1–30</div><div className="font-mono font-bold">{formatGBP(debtors.totals.days30Pence)}</div></div>
              <div><div className="text-muted-foreground text-xs">31–60</div><div className="font-mono font-bold">{formatGBP(debtors.totals.days60Pence)}</div></div>
              <div><div className="text-muted-foreground text-xs">61–90</div><div className="font-mono font-bold">{formatGBP(debtors.totals.days90Pence)}</div></div>
              <div><div className="text-muted-foreground text-xs">Total</div><div className="font-mono font-bold">{formatGBP(debtors.totals.totalOutstandingPence)}</div></div>
            </div>
            {debtors.rows.length > 0 && (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1–30</TableHead>
                  <TableHead className="text-right">31–60</TableHead>
                  <TableHead className="text-right">61–90</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {debtors.rows.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell className="text-right font-mono">{formatGBP(r.currentPence)}</TableCell>
                      <TableCell className="text-right font-mono">{formatGBP(r.days30Pence)}</TableCell>
                      <TableCell className="text-right font-mono">{formatGBP(r.days60Pence)}</TableCell>
                      <TableCell className="text-right font-mono">{formatGBP(r.days90Pence)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatGBP(r.totalOutstandingPence)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-y-2">
            <CardTitle className="">All invoices</CardTitle>
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f.value)}
                  className="rounded-xl text-xs font-bold"
                  data-testid={`filter-invoice-${f.value || "all"}`}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices match the current filter.</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((inv) => (
                  <TableRow key={inv.id} data-testid={`row-invoice-${inv.number}`}>
                    <TableCell><Link href={`/invoices/${inv.id}`} className="underline font-mono">{inv.number}</Link></TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell className="truncate max-w-xs">{inv.title}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[inv.status] ?? "outline"} className="">{inv.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(inv.totalPence)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-GB") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
