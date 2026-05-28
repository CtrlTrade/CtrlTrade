import { useState } from "react";
import { Link } from "wouter";
import {
  useListProjects,
  useCreateProject,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Plus, FolderOpen } from "lucide-react";
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

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function AppProjects() {
  const { data, isLoading } = useListProjects();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const create = useCreateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project created" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      data: {
        name: String(fd.get("name") ?? ""),
        status: (fd.get("status") as string) || "planning",
        description: (fd.get("description") as string) || undefined,
        startDate: (fd.get("startDate") as string) ? new Date(fd.get("startDate") as string).toISOString() : undefined,
        endDate: (fd.get("endDate") as string) ? new Date(fd.get("endDate") as string).toISOString() : undefined,
      },
    });
  }

  const filtered = (data ?? []).filter((p) => statusFilter === "all" || p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">Group related jobs under a single project umbrella</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-project">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="e.g. Office Refurbishment 2026" data-testid="input-project-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select name="status" className="w-full border rounded px-3 py-2 text-sm bg-background">
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} placeholder="Optional project description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending} data-testid="button-create-project">
                  {create.isPending ? "Creating…" : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first project to group related jobs together</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline text-primary">
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{project.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{project.jobCount}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatGBP(project.totalValuePence)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString("en-GB") : "—"}
                    {project.endDate ? ` → ${new Date(project.endDate).toLocaleDateString("en-GB")}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
