import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  useListAdminLeads,
  useImportAdminLeads,
  useCreateAdminLead,
  useUpdateAdminLead,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Upload,
  LayoutList,
  Columns3,
  ChevronRight,
  Funnel,
  Plus,
  Archive,
  Pencil,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUSES = ["new", "contacted", "demo_booked", "won", "lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  demo_booked: "Demo booked",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

const STATUS_COLOURS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  demo_booked: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  won: "bg-green-500/20 text-green-400 border-green-500/30",
  lost: "bg-muted/60 text-muted-foreground border-border/40",
  archived: "bg-muted/40 text-muted-foreground/60 border-border/30",
};

type LeadFormValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  trade: string;
  source: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: LeadFormValues = {
  name: "",
  email: "",
  phone: "",
  company: "",
  trade: "",
  source: "manual",
  status: "new",
  notes: "",
};

export function AdminLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "kanban">("table");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [form, setForm] = useState<LeadFormValues>(EMPTY_FORM);

  const { data: leads = [], isLoading } = useListAdminLeads({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const importMutation = useImportAdminLeads({
    mutation: {
      onSuccess: (result) => {
        toast({ title: `Imported ${result.imported} leads, skipped ${result.skipped}` });
        qc.invalidateQueries({ queryKey: ["/v1/admin/leads"] });
      },
      onError: () => toast({ title: "Import failed", variant: "destructive" }),
    },
  });

  const createMutation = useCreateAdminLead({
    mutation: {
      onSuccess: () => {
        toast({ title: "Lead created" });
        qc.invalidateQueries({ queryKey: ["/v1/admin/leads"] });
        setAddOpen(false);
        setForm(EMPTY_FORM);
      },
      onError: () => toast({ title: "Failed to create lead", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateAdminLead({
    mutation: {
      onSuccess: () => {
        toast({ title: "Lead updated" });
        qc.invalidateQueries({ queryKey: ["/v1/admin/leads"] });
        setEditLead(null);
        setForm(EMPTY_FORM);
      },
      onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    importMutation.mutate({ data: { csv } });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenAdd = () => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  };

  const handleOpenEdit = (lead: any) => {
    setForm({
      name: lead.name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      company: lead.company ?? "",
      trade: lead.trade ?? "",
      source: lead.source ?? "manual",
      status: lead.status ?? "new",
      notes: lead.notes ?? "",
    });
    setEditLead(lead);
  };

  const handleSubmitAdd = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({ data: form });
  };

  const handleSubmitEdit = () => {
    if (!editLead) return;
    updateMutation.mutate({ leadId: editLead.id, data: form });
  };

  const handleArchive = (lead: any) => {
    updateMutation.mutate(
      { leadId: lead.id, data: { status: "archived" } },
      {
        onSuccess: () => {
          toast({ title: `${lead.name} archived` });
          qc.invalidateQueries({ queryKey: ["/v1/admin/leads"] });
        },
      },
    );
  };

  const formIsPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Leads"
        icon={<Funnel className="h-6 w-6" />}
        actions={
          <>
            <Button
              size="sm"
              className="gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
              onClick={handleOpenAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold border-border text-foreground/80 hover:border-border rounded-xl"
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
              className={`gap-1 text-xs font-semibold ${view === "table" ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setView("table")}
            >
              <LayoutList className="h-3.5 w-3.5" /> Table
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 text-xs font-semibold ${view === "kanban" ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setView("kanban")}
            >
              <Columns3 className="h-3.5 w-3.5" /> Kanban
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary rounded-xl"
            placeholder="Search name, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", ...STATUSES, "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                statusFilter === s
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 bg-card" />
          ))}
        </div>
      ) : view === "table" ? (
        <TableView leads={leads} onEdit={handleOpenEdit} onArchive={handleArchive} />
      ) : (
        <KanbanView leads={leads} />
      )}

      <LeadFormDialog
        open={addOpen}
        title="Add Lead"
        form={form}
        setForm={setForm}
        onClose={() => { setAddOpen(false); setForm(EMPTY_FORM); }}
        onSubmit={handleSubmitAdd}
        isPending={formIsPending}
        submitLabel="Create Lead"
      />

      <LeadFormDialog
        open={!!editLead}
        title="Edit Lead"
        form={form}
        setForm={setForm}
        onClose={() => { setEditLead(null); setForm(EMPTY_FORM); }}
        onSubmit={handleSubmitEdit}
        isPending={formIsPending}
        submitLabel="Save Changes"
        showStatus
      />
    </div>
  );
}

function TableView({
  leads,
  onEdit,
  onArchive,
}: {
  leads: any[];
  onEdit: (lead: any) => void;
  onArchive: (lead: any) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="border border-border">
        <EmptyState
          icon={<Funnel className="h-10 w-10" />}
          heading="No leads found"
          subtext="Leads will appear here as they are captured or imported."
        />
      </div>
    );
  }

  return (
    <div className="border border-border overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-background">
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">Name</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground hidden md:table-cell">Company</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground hidden lg:table-cell">Trade</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground hidden sm:table-cell">Email</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground hidden md:table-cell">Source</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground hidden lg:table-cell">Received</th>
            <th className="w-24 px-4 py-3 text-xs font-bold text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border hover:bg-background transition-colors group">
              <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.company ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{lead.trade ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{lead.email}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{lead.source}</td>
              <td className="px-4 py-3">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs font-mono hidden lg:table-cell">
                {new Date(lead.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    title="Edit lead"
                    onClick={() => onEdit(lead)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {lead.status !== "archived" && (
                    <button
                      title="Archive lead"
                      onClick={() => onArchive(lead)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Link href={`/leads/${lead.id}`} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
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
            <span className="text-xs font-bold text-muted-foreground">{STATUS_LABELS[status]}</span>
            <span className="text-xs font-mono text-muted-foreground">{grouped[status].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[status].length === 0 && (
              <div className="border border-dashed border-border p-4 text-center text-border text-xs font-mono">
                Empty
              </div>
            )}
            {grouped[status].map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`}>
                <div className="border border-border bg-background hover:border-border cursor-pointer transition-colors p-3 space-y-1 rounded-xl">
                  <div className="font-semibold text-foreground text-sm">{lead.name}</div>
                  {lead.company && <div className="text-xs text-muted-foreground">{lead.company}</div>}
                  {lead.trade && <div className="text-xs text-muted-foreground">{lead.trade}</div>}
                  <div className="text-xs font-mono text-muted-foreground">{lead.email}</div>
                  <div className="text-xs text-muted-foreground">{lead.source}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls = STATUS_COLOURS[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-sm ${cls}`}>
      {label}
    </span>
  );
}

function LeadFormDialog({
  open,
  title,
  form,
  setForm,
  onClose,
  onSubmit,
  isPending,
  submitLabel,
  showStatus = false,
}: {
  open: boolean;
  title: string;
  form: LeadFormValues;
  setForm: (f: LeadFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
  showStatus?: boolean;
}) {
  const set = (key: keyof LeadFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Name *</label>
              <Input
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="Full name"
                value={form.name}
                onChange={set("name")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
              <Input
                type="email"
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="email@example.com"
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
              <Input
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="+44…"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Company</label>
              <Input
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="Company name"
                value={form.company}
                onChange={set("company")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Trade</label>
              <Input
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="e.g. Plumber"
                value={form.trade}
                onChange={set("trade")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Source</label>
              <Input
                className="bg-input border-border text-foreground rounded-xl text-sm"
                placeholder="manual, website…"
                value={form.source}
                onChange={set("source")}
              />
            </div>
            {showStatus && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                <select
                  className="w-full bg-input border border-border text-foreground rounded-xl text-sm px-3 py-2"
                  value={form.status}
                  onChange={set("status")}
                >
                  {[...STATUSES, "archived"].map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
            <Textarea
              className="bg-input border-border text-foreground rounded-xl text-sm resize-none"
              placeholder="Any notes…"
              rows={3}
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            onClick={onSubmit}
            disabled={!form.name.trim() || isPending}
          >
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
