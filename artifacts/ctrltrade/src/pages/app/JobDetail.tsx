import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetJob,
  useAssignJob,
  useListTeam,
  useListVehicles,
  useGenerateInvoiceFromJob,
  useListJobCheckins,
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
import { ArrowLeft, Receipt, MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TenantThread } from "@/components/TenantThread";
import { AiPanel } from "@/components/ai/AiPanel";
import { FileAttachments } from "@/components/FileAttachments";
import { CustomerInbox } from "@/components/CustomerInbox";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtCheckinTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtCheckinDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtDuration(minutes: number | null | undefined) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AppJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetJob(id);
  const { data: checkins } = useListJobCheckins(id);
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
        <Badge className="uppercase">{data.status.replace("_", " ")}</Badge>
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

      <Card className=" border-border shadow-sm">
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
                <SelectContent>{team?.members?.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
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

      <Card className=" border-border shadow-sm">
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

      <AiPanel
        title="CtrlAI — Job Summary"
        description="Generate a plain-English summary of this job for handover notes or customer communications."
        buttonLabel="Summarise Job"
        endpoint="v1/ai/job-summary"
        resultKey="summary"
        badgeLabel="AI"
        prompt={{
          jobId: id,
          jobNumber: data.number,
          status: data.status,
          description: data.description,
          customerName: (data as any).customerName,
          assignedUserName: (data as any).assignedUserName,
          scheduledStart: data.scheduledStart,
          scheduledEnd: data.scheduledEnd,
          valuePence: data.valuePence,
        }}
      />

      <FileAttachments parentKind="job" parentId={id} kind="job_photo" title="Photos & files" />

      <CustomerInbox jobId={id} customerId={(data as any).customerId} title="Customer messages" />

      {checkins && checkins.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Check-in History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Staff</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Check-in</th>
                  <th className="text-left">Check-out</th>
                  <th className="text-left">Duration</th>
                  <th className="text-left">GPS</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{c.userName ?? "—"}</td>
                    <td>{fmtCheckinDate(c.checkedInAt)}</td>
                    <td className="font-mono">{fmtCheckinTime(c.checkedInAt)}</td>
                    <td className="font-mono">
                      {c.checkedOutAt ? fmtCheckinTime(c.checkedOutAt) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500 uppercase text-xs">Active</Badge>
                      )}
                    </td>
                    <td className="font-mono">{fmtDuration(c.durationMinutes) ?? "—"}</td>
                    <td>
                      {c.checkInLat && c.checkInLng ? (
                        <a
                          href={`https://maps.google.com/?q=${c.checkInLat},${c.checkInLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          <span className="text-xs">View</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Total time on site:{" "}
              <span className="font-mono font-bold text-foreground">
                {(() => {
                  const total = checkins.reduce((acc, c) => acc + (c.durationMinutes ?? 0), 0);
                  const h = Math.floor(total / 60);
                  const m = total % 60;
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                })()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <TenantThread subjectKind="job" subjectId={id} />
    </div>
  );
}
