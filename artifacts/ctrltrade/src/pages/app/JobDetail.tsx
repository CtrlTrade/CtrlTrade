import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetJob,
  useAssignJob,
  useListTeam,
  useListVehicles,
  useGenerateInvoiceFromJob,
  useListJobCheckins,
  useListJobCostEntries,
  useCreateJobCostEntry,
  useUpdateJobCostEntry,
  useDeleteJobCostEntry,
  useImportJobCostsFromQuote,
  getGetJobQueryKey,
  getListJobsQueryKey,
  getListInvoicesQueryKey,
  getListJobCostEntriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Receipt, MapPin, Clock, Plus, Trash2, Pencil, X, Check, CheckCircle2 } from "lucide-react";
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

const KIND_LABELS: Record<string, string> = { labour: "Labour", material: "Material", other: "Other" };
const KIND_COLOURS: Record<string, string> = {
  labour: "bg-blue-500/15 text-blue-300",
  material: "bg-emerald-100 text-emerald-800",
  other: "bg-amber-500/15 text-amber-300",
};

interface CostEntryFormState {
  kind: string;
  description: string;
  quantity: string;
  unitCostPence: string;
  userId: string;
}

const defaultCostForm: CostEntryFormState = {
  kind: "labour",
  description: "",
  quantity: "1",
  unitCostPence: "0",
  userId: "",
};

export function AppJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetJob(id);
  const { data: checkins } = useListJobCheckins(id);
  const { data: costsData, isLoading: costsLoading } = useListJobCostEntries(id);
  const { data: team } = useListTeam();
  const { data: vehicles } = useListVehicles();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [showAddCost, setShowAddCost] = useState(false);
  const [costForm, setCostForm] = useState<CostEntryFormState>(defaultCostForm);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CostEntryFormState>(defaultCostForm);

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

  const invalidateCosts = () => qc.invalidateQueries({ queryKey: getListJobCostEntriesQueryKey(id) });

  const createCost = useCreateJobCostEntry({
    mutation: {
      onSuccess: () => { invalidateCosts(); setShowAddCost(false); setCostForm(defaultCostForm); toast({ title: "Cost entry added" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const updateCost = useUpdateJobCostEntry({
    mutation: {
      onSuccess: () => { invalidateCosts(); setEditingCostId(null); toast({ title: "Cost entry updated" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const deleteCost = useDeleteJobCostEntry({
    mutation: {
      onSuccess: () => { invalidateCosts(); toast({ title: "Cost entry removed" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const importFromQuote = useImportJobCostsFromQuote({
    mutation: {
      onSuccess: (result) => {
        invalidateCosts();
        toast({
          title: result.created > 0
            ? `${result.created} cost ${result.created === 1 ? "entry" : "entries"} imported`
            : "Nothing new to import",
          description: result.skipped > 0 ? `${result.skipped} already imported, skipped.` : undefined,
        });
      },
      onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
    },
  });

  function handleAddCost() {
    createCost.mutate({
      jobId: id,
      data: {
        kind: costForm.kind,
        description: costForm.description,
        quantity: parseFloat(costForm.quantity) || 1,
        unitCostPence: Math.round(parseFloat(costForm.unitCostPence) * 100) || 0,
        userId: costForm.userId || null,
      },
    });
  }

  function startEdit(entry: any) {
    setEditingCostId(entry.id);
    setEditForm({
      kind: entry.kind,
      description: entry.description,
      quantity: String(entry.quantity),
      unitCostPence: String((entry.unitCostPence / 100).toFixed(2)),
      userId: entry.userId ?? "",
    });
  }

  function handleSaveEdit(costId: string) {
    updateCost.mutate({
      jobId: id,
      costId,
      data: {
        kind: editForm.kind,
        description: editForm.description,
        quantity: parseFloat(editForm.quantity) || 1,
        unitCostPence: Math.round(parseFloat(editForm.unitCostPence) * 100) || 0,
        userId: editForm.userId || null,
      },
    });
  }

  // Auto-fill hourly rate when user is selected for labour
  function handleCostFormUserChange(userId: string, form: CostEntryFormState, setForm: (f: CostEntryFormState) => void) {
    const member = team?.members?.find((m: any) => m.userId === userId);
    const updates: Partial<CostEntryFormState> = { userId };
    if (form.kind === "labour" && member?.defaultHourlyRatePence) {
      updates.unitCostPence = String((member.defaultHourlyRatePence / 100).toFixed(2));
    }
    setForm({ ...form, ...updates });
  }

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Job not found.</p>;

  const entries = costsData?.entries ?? [];
  const hasActualCosts = entries.length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/jobs" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>
      <div className="flex flex-wrap gap-y-3 justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">
            Customer: <span className="font-medium">{data.customerName}</span> · Value: <span className="font-mono">{formatGBP(data.valuePence)}</span>
            {hasActualCosts && costsData && (
              <>
                {" "}· Costs: <span className="font-mono">{formatGBP(costsData.actualCostPence)}</span>
                {" "}· Margin: <span className={`font-mono font-bold ${costsData.grossMarginPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>{costsData.grossMarginPct}%</span>
              </>
            )}
          </p>
        </div>
        <Badge className="">{data.status.replace("_", " ")}</Badge>
      </div>

      {data.status === "completed" && (
        <Button
          onClick={() => generateInvoice.mutate({ jobId: id })}
          disabled={generateInvoice.isPending}
          className="rounded-xl font-bold"
          data-testid="button-generate-invoice"
        >
          <Receipt className="h-4 w-4 mr-2" />
          {generateInvoice.isPending ? "Generating…" : "Generate invoice"}
        </Button>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl border border-border">
          <TabsTrigger value="details" className="rounded-xl text-xs font-semibold">Details</TabsTrigger>
          <TabsTrigger value="costs" className="rounded-xl text-xs font-semibold" data-testid="tab-costs">
            Costs {hasActualCosts && <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">{entries.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-xl text-xs font-semibold">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-4">
          <Card className="border-border shadow-sm">
            <CardHeader><CardTitle className="">Details</CardTitle></CardHeader>
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
                <CardTitle className=" flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Check-in History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
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
                            <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-xs">Active</Badge>
                          )}
                        </td>
                        <td className="font-mono">{fmtDuration(c.durationMinutes) ?? "—"}</td>
                        <td>
                          {c.checkInLat && c.checkInLng ? (
                            <a href={`https://maps.google.com/?q=${c.checkInLat},${c.checkInLng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                              <MapPin className="h-3 w-3" /><span className="text-xs">View</span>
                            </a>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
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

          {(data as any).signoffAt && (
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className=" flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Job Completion Sign-off
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Signed by</p>
                    <p className="font-semibold">{(data as any).signoffName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Signed at</p>
                    <p className="font-semibold">{new Date((data as any).signoffAt).toLocaleString("en-GB")}</p>
                  </div>
                  {(data as any).signoffNote && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs mb-1">Work done notes</p>
                      <p className="whitespace-pre-wrap">{(data as any).signoffNote}</p>
                    </div>
                  )}
                </div>
                {(data as any).signoffImageUrl && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Customer Signature</p>
                    <div className="border border-border rounded p-3 bg-white inline-block">
                      <img
                        src={(data as any).signoffImageUrl}
                        alt="Customer signature"
                        className="max-w-xs max-h-40 object-contain"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <TenantThread subjectKind="job" subjectId={id} />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4 mt-4">
          {costsLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <>
              {costsData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Quoted value", value: formatGBP(costsData.quotedValuePence), accent: false },
                    { label: "Actual costs", value: formatGBP(costsData.actualCostPence), accent: false },
                    { label: "Labour", value: formatGBP(costsData.labourCostPence ?? 0), accent: false },
                    {
                      label: "Gross margin",
                      value: `${costsData.grossMarginPct}%`,
                      accent: true,
                      positive: costsData.grossMarginPct >= 0,
                    },
                  ].map((item) => (
                    <Card key={item.label} className="border-border shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground tracking-wide">{item.label}</p>
                        <p className={`text-2xl font-bold font-mono mt-1 ${item.accent ? (item.positive ? "text-emerald-600" : "text-red-600") : ""}`}>
                          {item.value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className=" text-sm">Cost Entries</CardTitle>
                  <div className="flex gap-2">
                    {data.quoteId && !showAddCost && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs font-semibold"
                        onClick={() => importFromQuote.mutate({ jobId: id })}
                        disabled={importFromQuote.isPending}
                        data-testid="button-import-quote-costs"
                      >
                        {importFromQuote.isPending ? "Importing…" : "Import from quote"}
                      </Button>
                    )}
                    {!showAddCost && (
                      <Button size="sm" className="rounded-xl text-xs font-semibold" onClick={() => setShowAddCost(true)} data-testid="button-add-cost">
                        <Plus className="h-3 w-3 mr-1" /> Add cost
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {showAddCost && (
                    <div className="p-4 border-b border-border bg-muted/30 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground">New cost entry</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Kind</Label>
                          <Select value={costForm.kind} onValueChange={(v) => setCostForm({ ...costForm, kind: v })}>
                            <SelectTrigger className="rounded-xl h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="labour">Labour</SelectItem>
                              <SelectItem value="material">Material</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Description</Label>
                          <Input className="rounded-xl h-8" value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} placeholder="e.g. Boiler part, labour hours…" data-testid="input-cost-description" />
                        </div>
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input className="rounded-xl h-8 font-mono" type="number" min="0" step="0.5" value={costForm.quantity} onChange={(e) => setCostForm({ ...costForm, quantity: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Unit cost (£)</Label>
                          <Input className="rounded-xl h-8 font-mono" type="number" min="0" step="0.01" value={costForm.unitCostPence} onChange={(e) => setCostForm({ ...costForm, unitCostPence: e.target.value })} data-testid="input-cost-unit" />
                        </div>
                        {costForm.kind === "labour" && (
                          <div>
                            <Label className="text-xs">Staff member</Label>
                            <Select value={costForm.userId} onValueChange={(v) => handleCostFormUserChange(v, costForm, setCostForm)}>
                              <SelectTrigger className="rounded-xl h-8"><SelectValue placeholder="Optional" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">— none —</SelectItem>
                                {team?.members?.map((m: any) => (
                                  <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}{m.defaultHourlyRatePence ? ` (${formatGBP(m.defaultHourlyRatePence)}/hr)` : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-xl text-xs font-semibold" disabled={createCost.isPending || !costForm.description} onClick={handleAddCost} data-testid="button-save-cost">
                          {createCost.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setShowAddCost(false); setCostForm(defaultCostForm); }}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {entries.length === 0 && !showAddCost ? (
                    <p className="p-6 text-sm text-muted-foreground">No cost entries yet. Add labour, materials and other costs to track actual job profitability.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left p-3">Kind</th>
                          <th className="text-left p-3">Description</th>
                          <th className="text-left p-3">Staff</th>
                          <th className="text-right p-3">Qty</th>
                          <th className="text-right p-3">Unit</th>
                          <th className="text-right p-3">Total</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="border-t border-border">
                            {editingCostId === entry.id ? (
                              <>
                                <td className="p-2">
                                  <Select value={editForm.kind} onValueChange={(v) => setEditForm({ ...editForm, kind: v })}>
                                    <SelectTrigger className="rounded-xl h-7 w-24"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="labour">Labour</SelectItem>
                                      <SelectItem value="material">Material</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2" colSpan={2}>
                                  <Input className="rounded-xl h-7" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                                </td>
                                <td className="p-2">
                                  <Input className="rounded-xl h-7 w-16 font-mono text-right" type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                                </td>
                                <td className="p-2">
                                  <Input className="rounded-xl h-7 w-20 font-mono text-right" type="number" step="0.01" value={editForm.unitCostPence} onChange={(e) => setEditForm({ ...editForm, unitCostPence: e.target.value })} />
                                </td>
                                <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                                  {formatGBP(Math.round((parseFloat(editForm.quantity) || 0) * (parseFloat(editForm.unitCostPence) || 0) * 100))}
                                </td>
                                <td className="p-2 flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(entry.id)} disabled={updateCost.isPending}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCostId(null)}><X className="h-3 w-3" /></Button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${KIND_COLOURS[entry.kind] ?? ""}`}>{KIND_LABELS[entry.kind] ?? entry.kind}</span></td>
                                <td className="p-3">{entry.description}{entry.productName ? <span className="ml-1 text-xs text-muted-foreground">({entry.productName})</span> : null}</td>
                                <td className="p-3 text-muted-foreground text-xs">{entry.userName ?? "—"}</td>
                                <td className="p-3 text-right font-mono text-xs">{entry.quantity}</td>
                                <td className="p-3 text-right font-mono text-xs">{formatGBP(entry.unitCostPence)}</td>
                                <td className="p-3 text-right font-mono font-bold">{formatGBP(entry.totalCostPence)}</td>
                                <td className="p-3 flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(entry)}><Pencil className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm("Delete this cost entry?")) deleteCost.mutate({ jobId: id, costId: entry.id }); }} disabled={deleteCost.isPending}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {entries.length > 0 && (
                        <tfoot className="border-t-2 border-border bg-muted/50">
                          <tr>
                            <td className="p-3 text-xs font-semibold text-muted-foreground" colSpan={5}>Total actual cost</td>
                            <td className="p-3 text-right font-mono font-bold">{formatGBP(costsData?.actualCostPence ?? 0)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card className="border-border shadow-sm">
            <CardHeader><CardTitle className="">Schedule & Assignment</CardTitle></CardHeader>
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
                className="rounded-xl font-bold"
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
