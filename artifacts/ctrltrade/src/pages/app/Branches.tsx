import { useState } from "react";
import {
  useListBranches,
  useCreateBranch,
  useGetBranch,
  useUpdateBranch,
  useDeleteBranch,
  getListBranchesQueryKey,
  type Branch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Pencil, Trash2, ChevronRight, Users, Briefcase, DollarSign } from "lucide-react";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function BranchDetailCard({ branchId }: { branchId: string }) {
  const { data, isLoading } = useGetBranch(branchId);
  if (isLoading || !data) return <Skeleton className="h-32" />;
  const stats = (data as any).stats ?? {};
  return (
    <div className="grid grid-cols-3 gap-4 text-sm mt-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Active Jobs</div>
          <div className="font-bold text-lg">{stats.activeJobs ?? 0}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Staff</div>
          <div className="font-bold text-lg">{stats.staffCount ?? 0}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Revenue (paid)</div>
          <div className="font-bold text-lg">{formatGBP(stats.revenuePaidPence ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}

export function AppBranches() {
  const { data, isLoading } = useListBranches();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBranchesQueryKey() });

  const create = useCreateBranch({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Branch created" }); setCreateOpen(false); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const update = useUpdateBranch({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Branch updated" }); setEditBranch(null); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const remove = useDeleteBranch({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Branch deleted" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      data: {
        name: String(fd.get("name") ?? ""),
        addressLine1: (fd.get("addressLine1") as string) || null,
        city: (fd.get("city") as string) || null,
        postcode: (fd.get("postcode") as string) || null,
        phone: (fd.get("phone") as string) || null,
        region: (fd.get("region") as string) || null,
      },
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editBranch) return;
    const fd = new FormData(e.currentTarget);
    update.mutate({
      id: editBranch.id,
      data: {
        name: String(fd.get("name") ?? ""),
        addressLine1: (fd.get("addressLine1") as string) || null,
        city: (fd.get("city") as string) || null,
        postcode: (fd.get("postcode") as string) || null,
        phone: (fd.get("phone") as string) || null,
        region: (fd.get("region") as string) || null,
      },
    });
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;

  const branches = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h2 className="text-2xl font-bold">Branches</h2>
          <p className="text-sm text-muted-foreground">Manage your office and site locations.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 text-xs font-semibold" data-testid="button-create-branch">
          <Plus className="h-4 w-4" />
          New Branch
        </Button>
      </div>

      {branches.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-bold mb-1">No branches yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first branch to start partitioning staff, jobs, and customers by location.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 text-xs font-semibold">
              <Plus className="h-4 w-4" />
              New Branch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <Card key={branch.id} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{branch.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {[branch.addressLine1, branch.city, branch.postcode].filter(Boolean).join(", ")}
                        {branch.region ? ` · ${branch.region}` : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === branch.id ? null : branch.id)}
                      className="gap-1 text-xs"
                      data-testid={`button-expand-branch-${branch.id}`}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedId === branch.id ? "rotate-90" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditBranch(branch)}
                      data-testid={`button-edit-branch-${branch.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete branch "${branch.name}"?`)) {
                          remove.mutate({ id: branch.id });
                        }
                      }}
                      data-testid={`button-delete-branch-${branch.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedId === branch.id && (
                <CardContent className="pt-0">
                  <BranchDetailCard branchId={branch.id} />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="">New Branch</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input name="name" required className="rounded-xl" placeholder="e.g. North London Office" data-testid="input-branch-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Address</Label>
                <Input name="addressLine1" className="rounded-xl" placeholder="123 Main St" />
              </div>
              <div>
                <Label>City</Label>
                <Input name="city" className="rounded-xl" placeholder="London" />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input name="postcode" className="rounded-xl" placeholder="EC1A 1BB" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input name="phone" className="rounded-xl" placeholder="+44 20 1234 5678" />
              </div>
            </div>
            <div>
              <Label>Region</Label>
              <Input name="region" className="rounded-xl" placeholder="e.g. South East" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} className="text-xs font-semibold" data-testid="button-submit-branch">
                {create.isPending ? "Creating…" : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {editBranch && (
        <Dialog open onOpenChange={() => setEditBranch(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="">Edit Branch</DialogTitle></DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input name="name" required defaultValue={editBranch.name} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Address</Label>
                  <Input name="addressLine1" defaultValue={editBranch.addressLine1 ?? ""} className="rounded-xl" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input name="city" defaultValue={editBranch.city ?? ""} className="rounded-xl" />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input name="postcode" defaultValue={editBranch.postcode ?? ""} className="rounded-xl" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={editBranch.phone ?? ""} className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label>Region</Label>
                <Input name="region" defaultValue={editBranch.region ?? ""} className="rounded-xl" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditBranch(null)}>Cancel</Button>
                <Button type="submit" disabled={update.isPending} className="text-xs font-semibold">
                  {update.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
