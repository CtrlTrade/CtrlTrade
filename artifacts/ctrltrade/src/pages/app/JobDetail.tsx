import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetJob,
  useAssignJob,
  useListTeam,
  useListVehicles,
  useGenerateInvoiceFromJob,
  getGetJobQueryKey,
  getListJobsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetJob(id);
  const { data: team } = useListTeam();
  const { data: vehicles } = useListVehicles();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (data) {
      setAssignedUserId(data.assignedUserId ?? "");
      setAssignedVehicleId(data.assignedVehicleId ?? "");
      setStart(toLocalInput(data.scheduledStart));
      setEnd(toLocalInput(data.scheduledEnd));
    }
  }, [data]);

  const generateInvoice = useGenerateInvoiceFromJob({
    mutation: {
      onSuccess: (inv) => {
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: `Invoice ${inv.number} created` });
        setLocation(`/invoices/${inv.id}`);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const assign = useAssignJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        toast({ title: "Job updated" });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Job not found.</p>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/jobs" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">
            Customer: <span className="font-medium">{data.customerName}</span> · Value: <span className="font-mono">{formatGBP(data.valuePence)}</span>
          </p>
        </div>
        <Badge className="uppercase rounded-none">{data.status.replace("_", " ")}</Badge>
      </div>

      {data.status === "completed" && (
        <Button
          onClick={() => generateInvoice.mutate({ jobId: id })}
          disabled={generateInvoice.isPending}
          className="rounded-none uppercase tracking-wider font-bold"
          data-testid="button-generate-invoice"
        >
          <Receipt className="h-4 w-4 mr-2" />
          {generateInvoice.isPending ? "Generating…" : "Generate invoice"}
        </Button>
      )}

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader><CardTitle className="uppercase tracking-tight">Schedule & Assignment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assigned to</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{team?.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={assignedVehicleId} onValueChange={setAssignedVehicleId}>
                <SelectTrigger><SelectValue placeholder="No vehicle" /></SelectTrigger>
                <SelectContent>{vehicles?.map((v) => <SelectItem key={v.id} value={v.id}>{v.label} ({v.registration})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="rounded-none uppercase tracking-wider font-bold"
            disabled={assign.isPending}
            data-testid="button-save-assignment"
            onClick={() => assign.mutate({
              jobId: id,
              data: {
                assignedUserId: assignedUserId || null,
                assignedVehicleId: assignedVehicleId || null,
                scheduledStart: start ? new Date(start).toISOString() : null,
                scheduledEnd: end ? new Date(end).toISOString() : null,
              },
            })}
          >
            {assign.isPending ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader><CardTitle className="uppercase tracking-tight">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.description && <p>{data.description}</p>}
          {(data.addressLine1 || data.city) && (
            <p className="text-muted-foreground">
              {[data.addressLine1, data.city, data.postcode].filter(Boolean).join(", ")}
            </p>
          )}
          {data.quoteId && (
            <p>From quote: <Link href={`/app/quotes/${data.quoteId}`} className="underline">{data.quoteId}</Link></p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
