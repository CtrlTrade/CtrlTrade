import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

export type Range = { from: Date; to: Date; label: string };

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
export function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export function defaultRange(): Range {
  const now = new Date();
  return { from: startOfMonth(now), to: now, label: "This month" };
}

export function presets(now: Date): Range[] {
  const sm = startOfMonth(now);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const sq = startOfQuarter(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return [
    { from: sm, to: now, label: "This month" },
    { from: lastMonthStart, to: lastMonthEnd, label: "Last month" },
    { from: sq, to: now, label: "This quarter" },
    { from: yearStart, to: now, label: "Year to date" },
  ];
}

export function useDateRange(): [Range, (r: Range) => void] {
  const [range, setRange] = useState<Range>(defaultRange());
  return [range, setRange];
}

export function DateRangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const opts = useMemo(() => presets(new Date()), []);
  const isCustom = !opts.some((o) => o.label === range.label);
  return (
    <div className="flex flex-wrap items-end gap-2">
      {opts.map((o) => {
        const active = !isCustom && o.label === range.label;
        return (
          <Button
            key={o.label}
            variant={active ? "default" : "outline"}
            size="sm"
            className="rounded-xl text-xs font-semibold"
            onClick={() => onChange(o)}
            data-testid={`range-${o.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {o.label}
          </Button>
        );
      })}
      <div className="flex items-end gap-2 ml-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">From</Label>
          <Input
            type="date"
            value={range.from.toISOString().slice(0, 10)}
            onChange={(e) =>
              onChange({ from: new Date(e.target.value), to: range.to, label: "Custom" })
            }
            className="rounded-xl h-9 text-xs"
            data-testid="range-from"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">To</Label>
          <Input
            type="date"
            value={range.to.toISOString().slice(0, 10)}
            onChange={(e) =>
              onChange({ from: range.from, to: new Date(e.target.value), label: "Custom" })
            }
            className="rounded-xl h-9 text-xs"
            data-testid="range-to"
          />
        </div>
      </div>
    </div>
  );
}

export function downloadCsv(filename: string, rows: Array<Record<string, any>>): void {
  if (rows.length === 0) {
    const blob = new Blob(["(no data)"], { type: "text/csv" });
    triggerDownload(filename, blob);
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportCsvButton({ filename, rows }: { filename: string; rows: Array<Record<string, any>> }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl text-xs font-semibold gap-2"
      onClick={() => downloadCsv(filename, rows)}
      data-testid="button-export-csv"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}

export function ReportShell({
  title,
  description,
  range,
  onChange,
  exportRows,
  exportFilename,
  children,
}: {
  title: string;
  description?: string;
  range: Range;
  onChange: (r: Range) => void;
  exportRows: Array<Record<string, any>>;
  exportFilename: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Card className=" border-border">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <ExportCsvButton filename={exportFilename} rows={exportRows} />
          </div>
        </CardHeader>
        <CardContent>
          <DateRangePicker range={range} onChange={onChange} />
        </CardContent>
      </Card>
      {children}
    </div>
  );
}

export function fmtGbp(p: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format((p ?? 0) / 100);
}

export function KpiRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label} className=" border-border">
          <CardContent className="p-4">
            <div className="text-[10px] font-bold text-muted-foreground mb-1">
              {it.label}
            </div>
            <div className="text-xl font-mono font-bold" data-testid={`kpi-${it.label.toLowerCase().replace(/\s+/g, "-")}`}>{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
