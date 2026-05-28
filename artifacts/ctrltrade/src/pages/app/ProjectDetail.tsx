import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, SkipForward, XCircle, Pencil, CalendarClock, Briefcase, User, MapPin, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useGetContract,
  useUpdateContract,
  useCancelContract,
  useTriggerContractJob,
  useSkipContractOccurrence,
  useListContractJobs,
} from "@workspace/api-client-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

const JOB_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  in_progress: "default",
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

const STATUS_OPTIONS = ["active", "paused", "cancelled", "completed"];

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function AppProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editFrequency, setEditFrequency] = useState("");

  const { data: contract, isLoading } = useGetContract(id!);

  const { data: jobs, isLoading: jobsLoading } = useListContractJobs(id!);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["getContract", id] });
    qc.invalidateQueries({ queryKey: ["listContractJobs", id] });
    qc.invalidateQueries({ queryKey: ["listContracts"] });
  }

  const updateMutation = useUpdateContract({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Project updated" }); setEditOpen(false); },
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

  function openEdit() {
    if (!contract) return;
    setEditStatus(contract.status);
    setEditFrequency(contract.frequency);
    setEditOpen(true);
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const endDate = fd.get("endDate") as string;
    const occurrences = fd.get("occurrences") as string;
    const nextDueAt = fd.get("nextDueAt") as string;
    updateMutation.mutate({
      contractId: id!,
      data: {
        title: (fd.get("title") as string) || undefined,
        frequency: editFrequency || undefined,
        status: editStatus || undefined,
        pricePence: fd.get("price") ? Math.round(Number(fd.get("price")) * 100) : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        occurrences: occurrences ? Number(occurrences) : undefined,
        nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        notes: (fd.get("notes") as string) || undefined,
        addressLine1: (fd.get("addressLine1") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        postcode: (fd.get("postcode") as string) || undefined,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-6">
        <Link href="/projects" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const addressParts = [contract.addressLine1, contract.city, contract.postcode].filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold">{contract.title}</h1>
          <Badge variant={STATUS_VARIANT[contract.status] ?? "outline"} className="capitalize">
            {contract.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {contract.status === "active" && (
            <>
              <Button variant="outline" size="sm" onClick={() => triggerMutation.mutate({ contractId: id! })} disabled={triggerMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate next job
              </Button>
              <Button variant="outline" size="sm" onClick={() => skipMutation.mutate({ contractId: id! })} disabled={skipMutation.isPending}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip occurrence
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {contract.status !== "cancelled" && (
            <Button
              variant="destructive"
              size="sm"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (confirm(`Cancel project "${contract.title}"? This cannot be undone.`)) {
                  cancelMutation.mutate({ contractId: id! });
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Frequency" value={FREQUENCY_LABELS[contract.frequency] ?? contract.frequency} />
            <DetailRow label="Start date" value={formatDate(contract.startDate)} />
            <DetailRow label="End date" value={formatDate(contract.endDate)} />
            <DetailRow label="Next due" value={formatDate(contract.nextDueAt)} />
            <DetailRow label="Max occurrences" value={contract.occurrences ?? "Unlimited"} />
            <DetailRow label="Jobs generated" value={`${contract.jobsGenerated}${contract.occurrences ? ` / ${contract.occurrences}` : ""}`} />
            <DetailRow label="Value per occurrence" value={formatGBP(contract.pricePence)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/customers/${contract.customerId}`} className="text-sm font-medium hover:underline">
                {contract.customerName}
              </Link>
            </CardContent>
          </Card>

          {addressParts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Service address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{addressParts.join("\n")}</p>
              </CardContent>
            </Card>
          )}

          {contract.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{contract.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Generated jobs
            {!jobsLoading && jobs && (
              <Badge variant="secondary" className="ml-2">{jobs.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !jobs?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Briefcase className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No jobs generated yet.</p>
              {contract.status === "active" && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => triggerMutation.mutate({ contractId: id! })}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate first job
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-muted-foreground text-xs">{(j.recurrenceIndex ?? 0) + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/jobs/${j.id}`} className="hover:underline">
                        {j.number} — {j.title}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(j.scheduledStart)}</TableCell>
                    <TableCell>
                      <Badge variant={JOB_STATUS_VARIANT[j.status] ?? "outline"} className="capitalize">
                        {j.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" name="title" defaultValue={contract.title} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency}>
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
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-endDate">End date</Label>
                <Input
                  id="edit-endDate"
                  name="endDate"
                  type="date"
                  defaultValue={contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-nextDueAt">Next due date</Label>
                <Input
                  id="edit-nextDueAt"
                  name="nextDueAt"
                  type="date"
                  defaultValue={contract.nextDueAt ? new Date(contract.nextDueAt).toISOString().split("T")[0] : ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-occurrences">Max occurrences</Label>
                <Input id="edit-occurrences" name="occurrences" type="number" min="1" defaultValue={contract.occurrences ?? ""} />
              </div>
              <div>
                <Label htmlFor="edit-price">Price (£)</Label>
                <Input
                  id="edit-price"
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={contract.pricePence / 100}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-addressLine1">Address</Label>
              <Input id="edit-addressLine1" name="addressLine1" defaultValue={contract.addressLine1 ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" name="city" defaultValue={contract.city ?? ""} />
              </div>
              <div>
                <Label htmlFor="edit-postcode">Postcode</Label>
                <Input id="edit-postcode" name="postcode" defaultValue={contract.postcode ?? ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" name="notes" rows={3} defaultValue={contract.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
