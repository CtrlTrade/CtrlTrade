import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetProject,
  useUpdateProject,
  useDeleteProject,
  useLinkJobToProject,
  useUnlinkJobFromProject,
  useListJobs,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Pencil, Trash2, Plus, X, FolderOpen, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  planning: "secondary",
  active: "default",
  completed: "default",
  cancelled: "outline",
};

const JOB_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "outline",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function AppProjectDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(id!);
  const { data: allJobs } = useListJobs();

  const [editOpen, setEditOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");

  const update = useUpdateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(id!) });
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project updated" });
        setEditOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const deleteProject = useDeleteProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project deleted" });
        navigate("~/app/projects");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const linkJob = useLinkJobToProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(id!) });
        toast({ title: "Job added to project" });
        setAddJobOpen(false);
        setSelectedJobId("");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const unlinkJob = useUnlinkJobFromProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(id!) });
        toast({ title: "Job removed from project" });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update.mutate({
      projectId: id!,
      data: {
        name: String(fd.get("name") ?? ""),
        status: (fd.get("status") as string) || undefined,
        description: (fd.get("description") as string) || null,
        startDate: (fd.get("startDate") as string) ? new Date(fd.get("startDate") as string).toISOString() : null,
        endDate: (fd.get("endDate") as string) ? new Date(fd.get("endDate") as string).toISOString() : null,
      },
    });
  }

  function handleDelete() {
    if (!confirm(`Delete project "${project?.name}"? This will unlink all jobs but not delete them.`)) return;
    deleteProject.mutate({ projectId: id! });
  }

  function handleLinkJob() {
    if (!selectedJobId) return;
    linkJob.mutate({ projectId: id!, data: { jobId: selectedJobId } });
  }

  function handleUnlinkJob(jobId: string) {
    unlinkJob.mutate({ projectId: id!, jobId });
  }

  const linkedJobIds = new Set((project?.jobs ?? []).map((j) => j.id));
  const availableJobs = (allJobs ?? []).filter((j) => !linkedJobIds.has(j.id));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-destructive">Project not found</div>;
  }

  const financials = project.financials ?? { totalValuePence: 0, totalInvoicedPence: 0, totalPaidPence: 0, outstandingPence: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                {STATUS_LABELS[project.status] ?? project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
            )}
            {(project.startDate || project.endDate) && (
              <p className="text-xs text-muted-foreground mt-1">
                {project.startDate ? new Date(project.startDate).toLocaleDateString("en-GB") : "—"}
                {" → "}
                {project.endDate ? new Date(project.endDate).toLocaleDateString("en-GB") : "Ongoing"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10" data-testid="button-delete-project">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={project.progressPct ?? 0} className="flex-1 h-3" />
            <span className="text-sm font-bold tabular-nums w-12 text-right">{project.progressPct ?? 0}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {(project.jobs ?? []).filter((j) => j.status === "completed").length} of {(project.jobs ?? []).length} jobs completed
          </p>
        </CardContent>
      </Card>

      {/* Financials */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-xl font-bold mt-1" data-testid="text-total-value">{formatGBP(financials.totalValuePence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Invoiced</p>
            <p className="text-xl font-bold mt-1">{formatGBP(financials.totalInvoicedPence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-xl font-bold mt-1 text-green-600">{formatGBP(financials.totalPaidPence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold mt-1 text-amber-600">{formatGBP(financials.outstandingPence)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Linked Jobs ({(project.jobs ?? []).length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddJobOpen(true)} data-testid="button-add-job">
              <Plus className="h-4 w-4 mr-1" />
              Add Job
            </Button>
            <Link href={`/jobs?projectId=${id}`}>
              <Button variant="outline" size="sm" asChild>
                <span>New Job in Project</span>
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(project.jobs ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No jobs linked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add existing jobs or create new ones from this project</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(project.jobs ?? []).map((job) => (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell>
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline text-primary">
                        {job.number} · {job.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{job.customerName}</TableCell>
                    <TableCell>
                      <Badge variant={JOB_STATUS_VARIANT[job.status] ?? "secondary"}>
                        {job.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.scheduledStart ? new Date(job.scheduledStart).toLocaleDateString("en-GB") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatGBP(job.valuePence)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleUnlinkJob(job.id)}
                        data-testid={`button-unlink-job-${job.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" defaultValue={project.name} required data-testid="input-edit-project-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select name="status" defaultValue={project.status} className="w-full border rounded px-3 py-2 text-sm bg-background">
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" name="description" rows={3} defaultValue={project.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  name="startDate"
                  type="date"
                  defaultValue={project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-endDate">End Date</Label>
                <Input
                  id="edit-endDate"
                  name="endDate"
                  type="date"
                  defaultValue={project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={update.isPending} data-testid="button-save-project">
                {update.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add existing job dialog */}
      <Dialog open={addJobOpen} onOpenChange={setAddJobOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Existing Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select a job to link to this project. Only jobs not already in a project are shown.</p>
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger data-testid="select-job-to-add">
                  <SelectValue placeholder="Select a job…" />
                </SelectTrigger>
                <SelectContent>
                  {availableJobs.length === 0 ? (
                    <SelectItem value="_none" disabled>No available jobs</SelectItem>
                  ) : (
                    availableJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.number} · {j.title} ({j.customerName})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setAddJobOpen(false); setSelectedJobId(""); }}>Cancel</Button>
            <Button onClick={handleLinkJob} disabled={!selectedJobId || linkJob.isPending} data-testid="button-confirm-add-job">
              {linkJob.isPending ? "Adding…" : "Add Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
