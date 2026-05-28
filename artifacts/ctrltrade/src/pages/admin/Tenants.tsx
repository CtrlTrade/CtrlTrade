import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListAdminTenants } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Users, ChevronLeft, ChevronRight } from "lucide-react";
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

export function AdminTenants() {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey]           = useState<SortKey>("name");
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  const [page, setPage]                 = useState(1);

  const { data: tenants, isLoading } = useListAdminTenants({
    query: { queryKey: ["adminTenants", search, statusFilter] }
  });

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
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-background">
          <div className="col-span-4"><ThBtn col="name"   label="Tenant"    /></div>
          <div className="col-span-2"><ThBtn col="status" label="Status"    /></div>
          <div className="col-span-3"><ThBtn col="seats"  label="Resources" /></div>
          <div className="col-span-2"><ThBtn col="mrr"    label="MRR"       /></div>
          <div className="col-span-1" />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 bg-card" />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            heading={search || statusFilter !== "all" ? "No tenants match filters" : "No tenants yet"}
            subtext={search || statusFilter !== "all" ? "Try adjusting the search or status filter." : "Tenants will appear here once they sign up."}
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
                <Link
                  key={tenant.id}
                  href={`/tenants/${tenant.id}`}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="col-span-4">
                    <div className="font-semibold text-foreground/90 text-sm truncate">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{tenant.ownerEmail}</div>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                      tenant.status === "active"    ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      tenant.status === "trial"     ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      tenant.status === "cancelled" ? "bg-muted text-muted-foreground border-border" :
                                                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {tenant.status}
                    </span>
                  </div>
                  <div className="col-span-3 text-xs text-muted-foreground font-mono">
                    {tenant.controlSeats}C / {tenant.fieldSeats}F / {tenant.tills}T
                  </div>
                  <div className="col-span-2 font-mono text-foreground/80 font-bold flex items-center gap-2">
                    £{tenant.monthlyTotal}
                    {(tenant as any).require2fa && (
                      <ShieldCheck className="h-3 w-3 text-green-400" aria-label="2FA enforced" />
                    )}
                  </div>
                  <div className="col-span-1 text-right text-xs font-semibold text-primary">
                    View →
                  </div>
                </Link>
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
    </div>
  );
}
