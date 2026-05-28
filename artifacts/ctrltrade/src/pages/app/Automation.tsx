import { useState } from "react";
import {
  useListAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useListAutomationRuns,
  useListApprovals,
  useDecideApproval,
  useListAutomationEvents,
  getListAutomationRulesQueryKey,
  getListAutomationRunsQueryKey,
  getListApprovalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
type AutomationConditionOperator = "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Zap, Plus, Pencil, Trash2, Check, X, Play, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Condition = { field: string; operator: AutomationConditionOperator; value?: string };
type Action = { kind: string; params: Record<string, string> };
type RuleForm = {
  name: string;
  description: string;
  triggerEvent: string;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
};

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const ACTION_KINDS = [
  { value: "send_sms", label: "Send SMS" },
  { value: "send_email", label: "Send Email" },
  { value: "send_notification", label: "Send In-App Notification" },
  { value: "create_approval", label: "Request Approval" },
  { value: "enqueue_job", label: "Enqueue Background Job" },
];

const BLANK_FORM: RuleForm = {
  name: "",
  description: "",
  triggerEvent: "",
  enabled: true,
  conditions: [],
  actions: [],
};

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    completed: "bg-green-500/15 text-green-400",
    failed: "bg-red-500/15 text-red-400",
    running: "bg-blue-500/15 text-blue-300",
    pending: "bg-yellow-500/15 text-yellow-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-xl font-mono ${variants[status] ?? "bg-muted"}`}>{status}</span>;
}

export function AppAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("rules");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(BLANK_FORM);

  const { data: rulesData, isLoading: rulesLoading } = useListAutomationRules();
  const { data: runsData, isLoading: runsLoading } = useListAutomationRuns({ limit: 50 } as any);
  const { data: approvalsData } = useListApprovals({ status: "pending" } as any);
  const { data: eventsData } = useListAutomationEvents();

  const create = useCreateAutomationRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
        setDialogOpen(false);
        toast({ title: "Rule created" });
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const update = useUpdateAutomationRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
        setDialogOpen(false);
        toast({ title: "Rule updated" });
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const del = useDeleteAutomationRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
        setDeleteId(null);
        toast({ title: "Rule deleted" });
      },
    },
  });

  const decide = useDecideApproval({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
        toast({ title: "Decision recorded" });
      },
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setDialogOpen(true);
  }

  function openEdit(rule: any) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      triggerEvent: rule.triggerEvent,
      enabled: rule.enabled,
      conditions: (rule.conditions ?? []) as Condition[],
      actions: (rule.actions ?? []) as Action[],
    });
    setDialogOpen(true);
  }

  function saveRule() {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      triggerEvent: form.triggerEvent,
      enabled: form.enabled,
      conditions: form.conditions,
      actions: form.actions,
    };
    if (editingId) {
      update.mutate({ id: editingId, data: payload });
    } else {
      create.mutate({ data: payload });
    }
  }

  function addCondition() {
    setForm((f) => ({ ...f, conditions: [...f.conditions, { field: "", operator: "equals" as AutomationConditionOperator, value: "" }] }));
  }

  function removeCondition(i: number) {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  }

  function addAction() {
    setForm((f) => ({ ...f, actions: [...f.actions, { kind: "send_sms", params: { to: "", text: "" } }] }));
  }

  function removeAction(i: number) {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  }

  const pendingCount = approvalsData?.approvals?.length ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">CtrlWorkflow</h1>
            <p className="text-sm text-muted-foreground">Rule-based automation across your CRM</p>
          </div>
        </div>
        {tab === "rules" && (
          <Button onClick={openCreate} className="gap-2 rounded-xl uppercase text-xs font-bold tracking-wider">
            <Plus className="h-4 w-4" /> New Rule
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="rules" className="rounded-xl uppercase text-xs font-bold tracking-wider">Rules</TabsTrigger>
          <TabsTrigger value="runs" className="rounded-xl uppercase text-xs font-bold tracking-wider">Run History</TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-xl uppercase text-xs font-bold tracking-wider">
            Approvals {pendingCount > 0 && <Badge className="ml-1 rounded-xl text-[10px] px-1 h-4">{pendingCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Rules */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          {rulesLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !rulesData?.rules?.length ? (
            <Card className="rounded-xl border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No automation rules yet</p>
                <p className="text-sm mt-1">Create a rule to automate actions when events happen in your CRM.</p>
                <Button onClick={openCreate} variant="outline" className="mt-4 rounded-xl uppercase text-xs font-bold tracking-wider gap-2">
                  <Plus className="h-4 w-4" /> Create first rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rulesData.rules.map((rule) => (
                <Card key={rule.id} className="rounded-xl">
                  <CardContent className="py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${rule.enabled ? "bg-green-500" : "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{rule.name}</span>
                          <Badge variant="outline" className="rounded-xl text-[10px] font-mono">{rule.triggerEvent}</Badge>
                          {!rule.enabled && <Badge variant="secondary" className="rounded-xl text-[10px]">Disabled</Badge>}
                        </div>
                        {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {(rule.conditions as any[]).length} condition{(rule.conditions as any[]).length !== 1 ? "s" : ""} · {(rule.actions as any[]).length} action{(rule.actions as any[]).length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Run History */}
        <TabsContent value="runs" className="mt-4">
          {runsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !runsData?.runs?.length ? (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No automation runs yet. Rules will appear here when they execute.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions Run</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsData.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-sm">{run.ruleName ?? "—"}</TableCell>
                      <TableCell><code className="text-xs">{run.triggerEvent}</code></TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell>{run.actionsRun}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Approvals */}
        <TabsContent value="approvals" className="mt-4">
          {!approvalsData?.approvals?.length ? (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Check className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No pending approvals.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvalsData.approvals.map((a) => (
                <Card key={a.id} className="rounded-xl border-amber-200">
                  <CardContent className="py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">{a.promptTitle}</p>
                        {a.promptBody && <p className="text-xs text-muted-foreground mt-0.5">{a.promptBody}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="rounded-xl gap-1 text-xs" onClick={() => decide.mutate({ id: a.id, data: { decision: "rejected" } })}>
                        <X className="h-3 w-3" /> Reject
                      </Button>
                      <Button size="sm" className="rounded-xl gap-1 text-xs" onClick={() => decide.mutate({ id: a.id, data: { decision: "approved" } })}>
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rule Builder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="">{editingId ? "Edit Rule" : "New Automation Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold tracking-wider">Rule Name *</Label>
                <Input className="rounded-xl" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. SMS on quote accepted" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold tracking-wider">Trigger Event *</Label>
                <Select value={form.triggerEvent} onValueChange={(v) => setForm((f) => ({ ...f, triggerEvent: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select event..." /></SelectTrigger>
                  <SelectContent>
                    {(eventsData?.events ?? []).map((e) => (
                      <SelectItem key={e.event} value={e.event}>{e.label} <span className="text-muted-foreground text-xs">({e.category})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider">Description</Label>
              <Input className="rounded-xl" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
              <Label className="text-xs">Rule enabled</Label>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase font-bold tracking-wider">Conditions (all must match)</Label>
                <Button size="sm" variant="outline" onClick={addCondition} className="rounded-xl text-xs h-7 gap-1"><Plus className="h-3 w-3" /> Add</Button>
              </div>
              {form.conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions — rule fires for every matching event.</p>}
              <div className="space-y-2">
                {form.conditions.map((cond, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="rounded-xl flex-1 text-xs" placeholder="field (e.g. status)" value={cond.field} onChange={(e) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], field: e.target.value }; return { ...f, conditions: c }; })} />
                    <Select value={cond.operator} onValueChange={(v) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], operator: v as AutomationConditionOperator }; return { ...f, conditions: c }; })}>
                      <SelectTrigger className="rounded-xl w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONDITION_OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="rounded-xl flex-1 text-xs" placeholder="value" value={cond.value ?? ""} onChange={(e) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], value: e.target.value }; return { ...f, conditions: c }; })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeCondition(i)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase font-bold tracking-wider">Actions (run in order)</Label>
                <Button size="sm" variant="outline" onClick={addAction} className="rounded-xl text-xs h-7 gap-1"><Plus className="h-3 w-3" /> Add</Button>
              </div>
              {form.actions.length === 0 && <p className="text-xs text-muted-foreground">Add at least one action.</p>}
              <div className="space-y-3">
                {form.actions.map((action, i) => (
                  <div key={i} className="border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={action.kind} onValueChange={(v) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], kind: v, params: {} }; return { ...f, actions: a }; })}>
                        <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ACTION_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => removeAction(i)}><X className="h-3 w-3" /></Button>
                    </div>
                    {action.kind === "send_sms" && (
                      <div className="space-y-1.5">
                        <Input className="rounded-xl text-xs" placeholder="To number (e.g. +447700900000 or use {{phone}})" value={action.params.to ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, to: e.target.value } }; return { ...f, actions: a }; })} />
                        <Input className="rounded-xl text-xs" placeholder="Message text (use {{field}} for variables)" value={action.params.text ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, text: e.target.value } }; return { ...f, actions: a }; })} />
                      </div>
                    )}
                    {action.kind === "send_email" && (
                      <div className="space-y-1.5">
                        <Input className="rounded-xl text-xs" placeholder="To email (or use {{email}})" value={action.params.to ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, to: e.target.value } }; return { ...f, actions: a }; })} />
                        <Input className="rounded-xl text-xs" placeholder="Subject" value={action.params.subject ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, subject: e.target.value } }; return { ...f, actions: a }; })} />
                        <Input className="rounded-xl text-xs" placeholder="Body text" value={action.params.text ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, text: e.target.value } }; return { ...f, actions: a }; })} />
                      </div>
                    )}
                    {action.kind === "create_approval" && (
                      <div className="space-y-1.5">
                        <Input className="rounded-xl text-xs" placeholder="Approval title" value={action.params.title ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, title: e.target.value } }; return { ...f, actions: a }; })} />
                        <Input className="rounded-xl text-xs" placeholder="Details / instructions" value={action.params.body ?? ""} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], params: { ...a[i].params, body: e.target.value } }; return { ...f, actions: a }; })} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl uppercase text-xs font-bold tracking-wider" onClick={saveRule} disabled={!form.name || !form.triggerEvent || create.isPending || update.isPending}>
              {editingId ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the automation rule and stop it from firing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive hover:bg-destructive/90" onClick={() => deleteId && del.mutate({ id: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
