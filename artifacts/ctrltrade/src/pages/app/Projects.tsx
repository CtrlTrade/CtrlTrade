import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, RefreshCw, SkipForward, XCircle, MoreHorizontal, FolderOpen, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useListContracts,
  useCreateContract,
  useCancelContract,
  useTriggerContractJob,
  useSkipContractOccurrence,
  useListCustomers,
} from "@workspace/api-client-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

export function AppProjects() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const { data: contracts, isLoading } = useListContracts(
    statusFilter !== "all" ? { status: statusFilter } : {},
  );
  const { data: customers } = useListCustomers();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["listContracts"] });
  }

  const createMutation = useCreateContract({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Project created" });
        setCreateOpen(false);
        setCustomerId("");
        setFrequency("monthly");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const cancelMutation = useCancelContract({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Project cancelled" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const triggerMutation = useTriggerContractJob({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Next job generation queued" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const skipMutation = useSkipContractOccurrence({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        toast({ title: "Occurrence skipped", description: `Next due: ${formatDate((data as any).nextDueAt)}` });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!customerId) return;
    const startDate = fd.get("startDate") as string;
    const endDate = fd.get("endDate") as string;
    const occurrences = fd.get("occurrences") as string;
    createMutation.mutate({
      data: {
        customerId,
        title: String(fd.get("title") ?? ""),
        frequency,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        occurrences: occurrences ? Number(occurrences) : undefined,
        pricePence: Math.round(Number(fd.get("price") ?? 0) * 100),
        notes: (fd.get("notes") as string) || undefined,
        addressLine1: (fd.get("addressLine1") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        postcode: (fd.get("postcode") as string) || undefined,
      },
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Recurring service agreements and scheduled job generation</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Project title *</Label>
                <Input id="title" name="title" placeholder="Annual boiler service" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequency *</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="price">Price (£)</Label>
                  <Input id="price" name="price" type="number" min="0" step="0.01" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start date *</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div>
                  <Label htmlFor="endDate">End date</Label>
                  <Input id="endDate" name="endDate" type="date" />
                </div>
              </div>
              <div>
                <Label htmlFor="occurrences">Max occurrences (optional)</Label>
                <Input id="occurrences" name="occurrences" type="number" min="1" placeholder="Leave blank for unlimited" />
              </div>
              <div>
                <Label htmlFor="addressLine1">Address</Label>
                <Input id="addressLine1" name="addressLine1" placeholder="Address line 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input id="postcode" name="postcode" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {["active", "paused", "completed", "cancelled", "all"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${contracts?.length ?? 0} project${contracts?.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !contracts?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No projects found</p>
              <p className="text-sm mt-1">Create your first project to start generating recurring jobs automatically.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link href={`/projects/${c.id}`} className="hover:underline flex items-center gap-1">
                        {c.title}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </TableCell>
                    <TableCell>{c.customerName}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[c.frequency] ?? c.frequency}</TableCell>
                    <TableCell>{formatDate(c.nextDueAt)}</TableCell>
                    <TableCell>{formatGBP(c.pricePence)}</TableCell>
                    <TableCell>
                      {c.jobsGenerated}
                      {c.occurrences ? ` / ${c.occurrences}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"} className="capitalize">
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${c.id}`}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              View project
                            </Link>
                          </DropdownMenuItem>
                          {c.status === "active" && (
                            <>
                              <DropdownMenuItem onClick={() => triggerMutation.mutate({ contractId: c.id })}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Generate next job now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => skipMutation.mutate({ contractId: c.id })}>
                                <SkipForward className="h-4 w-4 mr-2" />
                                Skip next occurrence
                              </DropdownMenuItem>
                            </>
                          )}
                          {c.status !== "cancelled" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Cancel project "${c.title}"? This cannot be undone.`)) {
                                  cancelMutation.mutate({ contractId: c.id });
                                }
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel project
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
