import { useState, useRef } from "react";
import { Link } from "wouter";
import { useListAdminLeads, useImportAdminLeads } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Upload, LayoutList, Columns3, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUSES = ["new", "contacted", "demo_booked", "won", "lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  demo_booked: "Demo Booked",
  won: "Won",
  lost: "Lost",
};

const STATUS_COLOURS: Record<LeadStatus, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  demo_booked: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  won: "bg-green-500/20 text-green-400 border-green-500/30",
  lost: "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",
};

export function AdminLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useListAdminLeads({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const importMutation = useImportAdminLeads({
    mutation: {
      onSuccess: (result) => {
        toast({ title: `Imported ${result.imported} leads, skipped ${result.skipped}` });
        qc.invalidateQueries({ queryKey: ["/v1/admin/leads"] });
        setImportDialogOpen(false);
      },
      onError: () => toast({ title: "Import failed", variant: "destructive" }),
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    importMutation.mutate({ data: { csv } });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold uppercase tracking-tighter text-white">Platform Leads</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 uppercase text-xs font-bold border-zinc-700 text-zinc-300 hover:border-zinc-500"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload className="h-3.5 w-3.5" />
            {importMutation.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 uppercase text-xs font-bold ${view === "table" ? "text-red-500" : "text-zinc-500"}`}
            onClick={() => setView("table")}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Table
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 uppercase text-xs font-bold ${view === "kanban" ? "text-red-500" : "text-zinc-500"}`}
            onClick={() => setView("kanban")}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            className="pl-9 bg-black border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-600 rounded-none"
            placeholder="Search name, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors ${
                statusFilter === s
                  ? "border-red-500 text-red-500 bg-red-500/10"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as LeadStatus]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 bg-zinc-900" />)}
        </div>
      ) : view === "table" ? (
        <TableView leads={leads} />
      ) : (
        <KanbanView leads={leads} />
      )}
    </div>
  );
}

function TableView({ leads }: { leads: any[] }) {
  if (leads.length === 0) {
    return (
      <div className="border border-zinc-800 p-16 text-center text-zinc-600 font-mono text-sm">
        No leads found.
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950">
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Name</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Company</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Trade</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Email</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Source</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Received</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-zinc-900 hover:bg-zinc-950 transition-colors">
              <td className="px-4 py-3 font-medium text-zinc-100">{lead.name}</td>
              <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{lead.company ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{lead.trade ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs hidden sm:table-cell">{lead.email}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell uppercase">{lead.source}</td>
              <td className="px-4 py-3">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-3 text-zinc-500 text-xs font-mono hidden lg:table-cell">
                {new Date(lead.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <Link href={`/leads/${lead.id}`} className="text-zinc-600 hover:text-red-500 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ leads }: { leads: any[] }) {
  const grouped: Record<string, any[]> = {};
  for (const s of STATUSES) grouped[s] = [];
  for (const lead of leads) {
    const bucket = STATUSES.includes(lead.status as LeadStatus) ? lead.status : "new";
    grouped[bucket].push(lead);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUSES.map((status) => (
        <div key={status} className="flex-shrink-0 w-64">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{STATUS_LABELS[status]}</span>
            <span className="text-xs font-mono text-zinc-600">{grouped[status].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[status].length === 0 && (
              <div className="border border-dashed border-zinc-800 p-4 text-center text-zinc-700 text-xs font-mono">
                Empty
              </div>
            )}
            {grouped[status].map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`}>
                <Card className="rounded-none border-zinc-800 bg-zinc-950 hover:border-zinc-600 cursor-pointer transition-colors shadow-none">
                  <CardContent className="p-3 space-y-1">
                    <div className="font-semibold text-zinc-100 text-sm">{lead.name}</div>
                    {lead.company && <div className="text-xs text-zinc-400">{lead.company}</div>}
                    {lead.trade && <div className="text-xs text-zinc-500">{lead.trade}</div>}
                    <div className="text-xs font-mono text-zinc-500">{lead.email}</div>
                    <div className="text-xs text-zinc-600 uppercase">{lead.source}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as LeadStatus] ?? status;
  const cls = STATUS_COLOURS[status as LeadStatus] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase border rounded-sm ${cls}`}>
      {label}
    </span>
  );
}
