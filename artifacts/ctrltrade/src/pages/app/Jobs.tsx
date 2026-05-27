import { useState } from "react";
import { Link } from "wouter";
import {
  useListJobs,
  useCreateJob,
  useListCustomers,
  useListTeam,
  getListJobsQueryKey,
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
import { Plus, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "outline",
};

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function AppJobs() {
  const { data, isLoading } = useListJobs();
  const { data: customers } = useListCustomers();
  const { data: team } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const create = useCreateJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        toast({ title: "Job created" });
        setOpen(false);
        setCustomerId(""); setAssignedUserId("");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!customerId) return;
    const toIso = (k: string) => {
      const v = fd.get(k) as string;
      return v ? new Date(v).toISOString() : undefined;
    };
    create.mutate({
      data: {
        customerId,
        title: String(fd.get("title") ?? ""),
        description: (fd.get("description") as string) || undefined,
        scheduledStart: toIso("scheduledStart"),
        scheduledEnd: toIso("scheduledEnd"),
        addressLine1: (fd.get("addressLine1") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        postcode: (fd.get("postcode") as string) || undefined,
        assignedUserId: assignedUserId || undefined,
        valuePence: Number(fd.get("valuePence") ?? 0) || 0,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Jobs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-job">
              <Plus className="h-4 w-4 mr-2" /> New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-2xl">
            <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Job</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                  <SelectContent>{customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input name="title" required /></div>
              <div><Label>Description</Label><Textarea name="description" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Scheduled start</Label><Input name="scheduledStart" type="datetime-local" /></div>
                <div><Label>Scheduled end</Label><Input name="scheduledEnd" type="datetime-local" /></div>
              </div>
              <div><Label>Address</Label><Input name="addressLine1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input name="city" /></div>
                <div><Label>Postcode</Label><Input name="postcode" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Assignee</Label>
                  <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>{team?.members?.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Value (pence)</Label><Input name="valuePence" type="number" min={0} defaultValue={0} /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || !customerId} className="rounded-none uppercase tracking-wider font-bold">
                  {create.isPending ? "Saving…" : "Save job"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2"><Briefcase className="h-5 w-5" /> All jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Number</TableHead><TableHead>Title</TableHead>
                <TableHead>Customer</TableHead><TableHead>Scheduled</TableHead>
                <TableHead>Assignee</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((j) => (
                  <TableRow key={j.id} data-testid={`row-job-${j.id}`}>
                    <TableCell className="font-mono">
                      <Link href={`/app/jobs/${j.id}`} className="hover:underline">{j.number}</Link>
                    </TableCell>
                    <TableCell>{j.title}</TableCell>
                    <TableCell>{j.customerName}</TableCell>
                    <TableCell className="font-mono text-sm">{j.scheduledStart ? new Date(j.scheduledStart).toLocaleString() : "—"}</TableCell>
                    <TableCell>{j.assignedUserName ?? "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[j.status] ?? "outline"} className="uppercase">{j.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(j.valuePence)}</TableCell>
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
