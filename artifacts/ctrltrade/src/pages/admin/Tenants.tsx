import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminTenants,
  useAdminCreateTenant,
  useAdminUpdateTenant,
  useAdminDeleteTenant,
  getListAdminTenantsQueryKey,
} from "@workspace/api-client-react";
import type { AdminTenantSummary } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";

const PAGE_SIZE = 20;

type SortKey = "name" | "status" | "mrr" | "seats";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 text-muted-foreground ml-1 inline" />;
  return sortDir === "asc"
    ? <ArrowUp   className="h-3 w-3 text-primary ml-1 inline" />
    : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
}

const STATUS_OPTIONS = ["trial", "active", "cancelled", "suspended"] as const;

function statusBadgeClass(status: string) {
  if (status === "active")    return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status === "trial")     return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (status === "cancelled") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------
interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (t: AdminTenantSummary) => void;
}

function CreateTenantDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [name, setName]                   = useState("");
  const [ownerEmail, setOwnerEmail]       = useState("");
  const [ownerName, setOwnerName]         = useState("");
  const [password, setPassword]           = useState("");
  const [status, setStatus]               = useState<string>("active");
  const [controlSeats, setControlSeats]   = useState(1);
  const [fieldSeats, setFieldSeats]       = useState(1);
  const [tills, setTills]                 = useState(1);
  const [branchName, setBranchName]       = useState("");
  const [error, setError]                 = useState<string | null>(null);

  const { mutate, isPending } = useAdminCreateTenant({
    mutation: {
      onSuccess: (tenant) => {
        onCreated(tenant);
        resetAndClose();
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error ?? err?.message ?? "Something went wrong");
      },
    },
  });

  function resetAndClose() {
    setName(""); setOwnerEmail(""); setOwnerName(""); setPassword(""); setStatus("active");
    setControlSeats(1); setFieldSeats(1); setTills(1); setBranchName(""); setError(null);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    mutate({
      data: {
        name,
        ownerEmail,
        ownerName,
        ownerPassword: password,
        status,
        controlSeats,
        fieldSeats,
        tills,
        branchName: branchName.trim() || undefined,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Create tenant</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Set up a new tenant, its owner account, and initial subscription.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-name">Company name</Label>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Trades Ltd"
              required
              minLength={2}
              className="rounded-xl border-border bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-email">Owner email</Label>
            <Input
              id="ct-email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@acme.com"
              required
              className="rounded-xl border-border bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-owner-name">Owner name</Label>
            <Input
              id="ct-owner-name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="rounded-xl border-border bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-password">Temporary password</Label>
            <Input
              id="ct-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              className="rounded-xl border-border bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-status">Initial status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="ct-status" className="rounded-xl border-border bg-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-card">
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subscription</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-control">Control seats</Label>
                <Input
                  id="ct-control"
                  type="number"
                  min={0}
                  value={controlSeats}
                  onChange={(e) => setControlSeats(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl border-border bg-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-field">Field seats</Label>
                <Input
                  id="ct-field"
                  type="number"
                  min={0}
                  value={fieldSeats}
                  onChange={(e) => setFieldSeats(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl border-border bg-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-tills">Tills</Label>
                <Input
                  id="ct-tills"
                  type="number"
                  min={0}
                  value={tills}
                  onChange={(e) => setTills(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl border-border bg-input"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default branch</p>
            <div className="space-y-1.5">
              <Label htmlFor="ct-branch">Branch name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="ct-branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={name || "Acme Trades Ltd"}
                className="rounded-xl border-border bg-input"
              />
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="rounded-xl">
              {isPending ? "Creating…" : "Create tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------
interface EditDialogProps {
  tenant: AdminTenantSummary | null;
  onClose: () => void;
  onUpdated: (t: AdminTenantSummary) => void;
}

function EditTenantDialog({ tenant, onClose, onUpdated }: EditDialogProps) {
  const [name, setName]     = useState(tenant?.name ?? "");
  const [status, setStatus] = useState(tenant?.status ?? "active");
  const [error, setError]   = useState<string | null>(null);

  const { mutate, isPending } = useAdminUpdateTenant({
    mutation: {
      onSuccess: (updated) => {
        onUpdated(updated);
        onClose();
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error ?? err?.message ?? "Something went wrong");
      },
    },
  });

  if (!tenant) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    mutate({ tenantId: tenant!.id, data: { name, status } });
  }

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Update <span className="font-semibold text-foreground">{tenant.name}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="et-name">Company name</Label>
            <Input
              id="et-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="rounded-xl border-border bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="et-status" className="rounded-xl border-border bg-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-card">
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="rounded-xl">
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------
interface DeleteDialogProps {
  tenant: AdminTenantSummary | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteTenantDialog({ tenant, onClose, onDeleted }: DeleteDialogProps) {
  const [confirm, setConfirm] = useState("");
  const [error, setError]     = useState<string | null>(null);

  const { mutate, isPending } = useAdminDeleteTenant({
    mutation: {
      onSuccess: () => {
        onDeleted(tenant!.id);
        onClose();
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error ?? err?.message ?? "Something went wrong");
      },
    },
  });

  if (!tenant) return null;

  const isConfirmed = confirm.trim() === tenant.name.trim();

  function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!isConfirmed) return;
    setError(null);
    mutate({ tenantId: tenant!.id });
  }

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => { if (!o) { setConfirm(""); setError(null); onClose(); } }}>
      <DialogContent className="sm:max-w-md rounded-xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete tenant</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            This permanently deletes <span className="font-semibold text-foreground">{tenant.name}</span> and all
            associated data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleDelete} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-bold text-foreground">{tenant.name}</span> to confirm
            </Label>
            <Input
              id="del-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={tenant.name}
              className="rounded-xl border-border bg-input"
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setConfirm(""); setError(null); onClose(); }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isConfirmed || isPending}
              className="rounded-xl"
            >
              {isPending ? "Deleting…" : "Delete tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function AdminTenants() {
  const qc = useQueryClient();

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey]           = useState<SortKey>("name");
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  const [page, setPage]                 = useState(1);

  const [showCreate, setShowCreate]       = useState(false);
  const [editTenant, setEditTenant]       = useState<AdminTenantSummary | null>(null);
  const [deleteTenant, setDeleteTenant]   = useState<AdminTenantSummary | null>(null);

  const { data: tenants, isLoading } = useListAdminTenants({
    query: { queryKey: ["adminTenants", search, statusFilter] }
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() });
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!tenants) return [];
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesSearch =
        !q ||
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.ownerEmail ?? "").toLowerCase().includes(q) ||
        (t.id ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
      } else if (sortKey === "status") {
        cmp = (a.status ?? "").localeCompare(b.status ?? "");
      } else if (sortKey === "mrr") {
        cmp = (Number(a.monthlyTotal) || 0) - (Number(b.monthlyTotal) || 0);
      } else if (sortKey === "seats") {
        const seatsA = (a.controlSeats || 0) + (a.fieldSeats || 0);
        const seatsB = (b.controlSeats || 0) + (b.fieldSeats || 0);
        cmp = seatsA - seatsB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageStart   = (safePage - 1) * PAGE_SIZE;
  const pageEnd     = Math.min(pageStart + PAGE_SIZE, sorted.length);
  const pageItems   = sorted.slice(pageStart, pageEnd);

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      className="flex items-center gap-0.5 font-semibold text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  );

  const subtitleText = isLoading
    ? undefined
    : sorted.length === 0
    ? (tenants ? `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} total` : undefined)
    : `Showing ${pageStart + 1}–${pageEnd} of ${sorted.length} tenant${sorted.length !== 1 ? "s" : ""}${
        tenants && sorted.length < tenants.length ? ` (filtered from ${tenants.length})` : ""
      }`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tenants directory"
        subtitle={subtitleText}
        icon={<Users className="h-6 w-6" />}
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            className="rounded-xl gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Add tenant
          </Button>
        }
      />

      <Card className="rounded-xl border-border bg-card shadow-none p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 rounded-xl border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleFilter}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-border bg-input text-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-card text-foreground">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="past_due">Past due</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-border bg-background">
          <div><ThBtn col="name"   label="Tenant"    /></div>
          <div><ThBtn col="status" label="Status"    /></div>
          <div className="hidden sm:block"><ThBtn col="seats"  label="Resources" /></div>
          <div><ThBtn col="mrr"    label="MRR"       /></div>
          <div className="w-24" />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 bg-card" />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            heading={search || statusFilter !== "all" ? "No tenants match filters" : "No tenants yet"}
            subtext={search || statusFilter !== "all" ? "Try adjusting the search or status filter." : "Create a tenant using the button above."}
            action={
              (search || statusFilter !== "all") ? (
                <button
                  className="text-xs text-primary font-semibold hover:underline"
                  onClick={() => { handleSearch(""); handleFilter("all"); }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border">
              {pageItems.map((tenant) => (
                <div
                  key={tenant.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/40 transition-colors group"
                >
                  <Link
                    href={`/tenants/${tenant.id}`}
                    className="min-w-0 cursor-pointer"
                  >
                    <div className="font-semibold text-foreground/90 text-sm truncate group-hover:text-primary transition-colors">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{tenant.ownerEmail}</div>
                  </Link>
                  <div>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border whitespace-nowrap ${statusBadgeClass(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </div>
                  <div className="hidden sm:block text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {tenant.controlSeats}C / {tenant.fieldSeats}F / {tenant.tills}T
                  </div>
                  <div className="font-mono text-foreground/80 font-bold text-sm whitespace-nowrap flex items-center gap-1.5">
                    £{tenant.monthlyTotal}
                    {(tenant as any).require2fa && (
                      <ShieldCheck className="h-3 w-3 text-green-400 shrink-0" aria-label="2FA enforced" />
                    )}
                  </div>
                  <div className="w-24 flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditTenant(tenant); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTenant(tenant); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      href={`/tenants/${tenant.id}`}
                      className="text-xs font-semibold text-primary whitespace-nowrap hover:underline px-1"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background">
                <span className="text-xs text-muted-foreground font-mono">
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border-border bg-card text-foreground/80 hover:bg-muted disabled:opacity-40 h-7 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push("…");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span key={`ellipsis-${idx}`} className="text-muted-foreground text-xs px-1">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          className={`w-7 h-7 text-xs font-semibold rounded-lg border transition-colors ${
                            item === safePage
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-xl border-border bg-card text-foreground/80 hover:bg-muted disabled:opacity-40 h-7 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateTenantDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { invalidate(); setShowCreate(false); }}
      />
      <EditTenantDialog
        tenant={editTenant}
        onClose={() => setEditTenant(null)}
        onUpdated={() => { invalidate(); setEditTenant(null); }}
      />
      <DeleteTenantDialog
        tenant={deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onDeleted={() => { invalidate(); setDeleteTenant(null); }}
      />
    </div>
  );
}
