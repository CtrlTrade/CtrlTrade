import { useState } from "react";
import {
  useListAreaManagers,
  useCreateAreaManager,
  useUpdateAreaManager,
  useDeleteAreaManager,
  useListBranches,
  useListTeam,
  getListAreaManagersQueryKey,
  type AreaManager,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserCog, Pencil, Trash2, MapPin } from "lucide-react";

export function AppAreaManagers() {
  const { data: managers, isLoading } = useListAreaManagers();
  const { data: branches } = useListBranches();
  const { data: team } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editManager, setEditManager] = useState<AreaManager | null>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAreaManagersQueryKey() });

  const create = useCreateAreaManager({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Area manager assigned" });
        setCreateOpen(false);
        setSelectedUserId("");
        setSelectedBranchIds([]);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const update = useUpdateAreaManager({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Area manager updated" }); setEditManager(null); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const remove = useDeleteAreaManager({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Area manager removed" }); },
    },
  });

  function toggleBranch(branchId: string, checked: boolean) {
    setSelectedBranchIds((prev) =>
      checked ? [...prev, branchId] : prev.filter((id) => id !== branchId),
    );
  }

  const controlMembers = (team?.members ?? []).filter(
    (m) => m.seatType === "control" && m.status === "active",
  );

  const managerUserIds = new Set((managers ?? []).map((m) => m.userId));
  const availableMembers = controlMembers.filter((m) => !managerUserIds.has(m.userId));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;

  const areaManagers = managers ?? [];
  const branchList = branches ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tighter">Area Managers</h2>
          <p className="text-sm text-muted-foreground">Assign Control Seat staff to oversee one or more branches.</p>
        </div>
        <Button
          onClick={() => { setSelectedUserId(""); setSelectedBranchIds([]); setCreateOpen(true); }}
          className="gap-2 uppercase text-xs tracking-wider font-bold"
          disabled={branchList.length === 0}
          title={branchList.length === 0 ? "Create at least one branch first" : undefined}
          data-testid="button-assign-area-manager"
        >
          <Plus className="h-4 w-4" />
          Assign Manager
        </Button>
      </div>

      {branchList.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm text-amber-700 dark:text-amber-400">
            No branches configured yet. Create branches first under <strong>Settings → Branches</strong> before assigning area managers.
          </CardContent>
        </Card>
      )}

      {areaManagers.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-bold uppercase tracking-tight mb-1">No area managers yet</h3>
            <p className="text-sm text-muted-foreground">Assign a staff member as an area manager to give them scoped visibility over specific branches.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {areaManagers.map((am) => (
            <Card key={am.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCog className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base uppercase tracking-tight">{am.userName ?? am.userEmail ?? am.userId}</CardTitle>
                      <CardDescription className="text-xs">{am.userEmail}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBranchIds([...(am.branchIds ?? [])]);
                        setEditManager(am);
                      }}
                      data-testid={`button-edit-area-manager-${am.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove ${am.userName ?? am.userId} as area manager?`)) {
                          remove.mutate({ id: am.id });
                        }
                      }}
                      data-testid={`button-delete-area-manager-${am.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(am.branches ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No branches assigned</span>
                  ) : (
                    (am.branches ?? []).map((b) => (
                      <Badge key={b.id} variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.name}
                      </Badge>
                    ))
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="uppercase tracking-tight">Assign Area Manager</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Staff Member (Control Seat)</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-none" data-testid="select-area-manager-user">
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name} ({m.email}) — {m.role}
                    </SelectItem>
                  ))}
                  {availableMembers.length === 0 && (
                    <SelectItem value="__none__" disabled>No eligible staff available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Assigned Branches</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                {branchList.map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`create-branch-${b.id}`}
                      checked={selectedBranchIds.includes(b.id)}
                      onCheckedChange={(checked) => toggleBranch(b.id, !!checked)}
                    />
                    <label htmlFor={`create-branch-${b.id}`} className="text-sm cursor-pointer">
                      {b.name}{b.city ? ` — ${b.city}` : ""}
                    </label>
                  </div>
                ))}
                {branchList.length === 0 && <p className="text-sm text-muted-foreground">No branches available.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedUserId || selectedUserId === "__none__" || create.isPending}
              onClick={() => create.mutate({ data: { userId: selectedUserId, branchIds: selectedBranchIds } })}
              className="uppercase text-xs tracking-wider font-bold"
              data-testid="button-submit-area-manager"
            >
              {create.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editManager && (
        <Dialog open onOpenChange={() => setEditManager(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tight">Edit Branch Assignments</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manager: <strong>{editManager.userName ?? editManager.userEmail}</strong>
              </p>
              <div>
                <Label className="mb-2 block">Assigned Branches</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                  {branchList.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-branch-${b.id}`}
                        checked={selectedBranchIds.includes(b.id)}
                        onCheckedChange={(checked) => toggleBranch(b.id, !!checked)}
                      />
                      <label htmlFor={`edit-branch-${b.id}`} className="text-sm cursor-pointer">
                        {b.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditManager(null)}>Cancel</Button>
              <Button
                disabled={update.isPending}
                onClick={() => update.mutate({ id: editManager.id, data: { userId: editManager.userId, branchIds: selectedBranchIds } })}
                className="uppercase text-xs tracking-wider font-bold"
              >
                {update.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
