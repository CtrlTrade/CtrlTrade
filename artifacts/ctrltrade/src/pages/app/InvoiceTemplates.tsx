import { useState } from "react";
import { Link } from "wouter";
import {
  useListInvoiceTemplates,
  useCreateInvoiceTemplate,
  useUpdateInvoiceTemplate,
  useDeleteInvoiceTemplate,
  useRunInvoiceTemplate,
  useListCustomers,
  getListInvoiceTemplatesQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Play, Pencil, Power } from "lucide-react";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

interface ItemDraft { description: string; quantity: number; unitPricePence: number }

export function AppInvoiceTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListInvoiceTemplates();
  const { data: customers } = useListCustomers();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const nowIso = new Date().toISOString().slice(0, 10);
  const [nextRun, setNextRun] = useState(nowIso);
  const [notes, setNotes] = useState("");
  const [vatRatePct, setVatRatePct] = useState<number>(20);
  const [items, setItems] = useState<ItemDraft[]>([{ description: "", quantity: 1, unitPricePence: 0 }]);

  const resetForm = () => {
    setEditingId(null);
    setTitle(""); setCustomerId("");
    setFrequency("monthly");
    setNextRun(nowIso);
    setNotes("");
    setVatRatePct(20);
    setItems([{ description: "", quantity: 1, unitPricePence: 0 }]);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListInvoiceTemplatesQueryKey() });
  };

  const create = useCreateInvoiceTemplate({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Template created" });
        setShowForm(false);
        resetForm();
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const update = useUpdateInvoiceTemplate({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Template updated" });
        setShowForm(false);
        resetForm();
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const del = useDeleteInvoiceTemplate({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Template deleted" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const run = useRunInvoiceTemplate({
    mutation: {
      onSuccess: (inv) => {
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        invalidate();
        toast({ title: `Invoice ${inv.number} generated` });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const submit = () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const cleaned = items
      .filter((it) => it.description.trim().length > 0 && it.quantity > 0)
      .map((it) => ({ description: it.description, quantity: Math.floor(it.quantity), unitPricePence: Math.floor(it.unitPricePence) }));
    if (cleaned.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    const trimmedNotes = notes.trim();
    if (editingId) {
      update.mutate({
        templateId: editingId,
        data: {
          title,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
          frequency,
          nextRunAt: new Date(nextRun).toISOString(),
          vatRatePct,
          items: cleaned,
        },
      });
    } else {
      if (!customerId) {
        toast({ title: "Customer required", variant: "destructive" });
        return;
      }
      create.mutate({
        data: {
          customerId,
          title,
          ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
          frequency,
          nextRunAt: new Date(nextRun).toISOString(),
          vatRatePct,
          items: cleaned,
        },
      });
    }
  };

  const startEdit = (t: NonNullable<typeof data>[number]) => {
    setEditingId(t.id);
    setCustomerId(t.customerId);
    setTitle(t.title);
    setFrequency(t.frequency as typeof frequency);
    setNextRun(new Date(t.nextRunAt).toISOString().slice(0, 10));
    setNotes(t.notes ?? "");
    setVatRatePct(t.vatRatePct);
    setItems(t.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPricePence: it.unitPricePence })));
    setShowForm(true);
  };
  const toggleActive = (templateId: string, active: boolean) => {
    update.mutate({ templateId, data: { active: !active } });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/invoices" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Recurring invoices</h1>
        <Button onClick={() => { resetForm(); setShowForm((s) => !s); }}
          className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" /> New template
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader><CardTitle className="uppercase tracking-tight">{editingId ? "Edit template" : "New template"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground">Customer</label>
                <select className="w-full border rounded-none p-2 bg-background"
                  value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                  disabled={!!editingId}
                  data-testid="select-template-customer">
                  <option value="">— Select —</option>
                  {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Frequency</label>
                <select className="w-full border rounded-none p-2 bg-background"
                  value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Title</label>
                <Input className="rounded-none" value={title} onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-template-title" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">First run date</label>
                <Input className="rounded-none" type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">VAT rate %</label>
                <Input className="rounded-none font-mono" type="number" min={0} max={100} value={vatRatePct}
                  onChange={(e) => setVatRatePct(Number(e.target.value) || 0)}
                  data-testid="input-template-vat" />
              </div>
              <div className="col-span-2">
                <label className="text-xs uppercase text-muted-foreground">Notes</label>
                <Input className="rounded-none" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes shown on each generated invoice"
                  data-testid="input-template-notes" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Line items</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="rounded-none col-span-7" placeholder="Description" value={it.description}
                      onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} />
                    <Input className="rounded-none col-span-2 font-mono" type="number" min={1} value={it.quantity}
                      onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} />
                    <Input className="rounded-none col-span-2 font-mono" type="number" min={0} value={it.unitPricePence}
                      placeholder="Pence"
                      onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, unitPricePence: Number(e.target.value) || 0 } : x))} />
                    <Button variant="ghost" size="sm" className="col-span-1"
                      onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => setItems((arr) => [...arr, { description: "", quantity: 1, unitPricePence: 0 }])}
                  className="rounded-none uppercase tracking-wider text-xs font-bold">
                  <Plus className="h-4 w-4 mr-2" /> Add line
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={create.isPending || update.isPending}
                className="rounded-none uppercase tracking-wider font-bold" data-testid="button-save-template">
                {editingId ? "Save changes" : "Save template"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}
                className="rounded-none uppercase tracking-wider font-bold">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader><CardTitle className="uppercase tracking-tight">Templates</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recurring templates yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((t) => {
                  const subtotal = t.items.reduce((s, it) => s + it.quantity * it.unitPricePence, 0);
                  const total = subtotal + Math.round((subtotal * t.vatRatePct) / 100);
                  return (
                    <TableRow key={t.id} data-testid={`row-template-${t.id}`}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.customerName}</TableCell>
                      <TableCell className="uppercase text-xs">{t.frequency}</TableCell>
                      <TableCell className="text-sm">{new Date(t.nextRunAt).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell className="text-right font-mono">{formatGBP(total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => run.mutate({ templateId: t.id })}
                            disabled={run.isPending || !t.active}
                            className="rounded-none uppercase tracking-wider text-xs font-bold" data-testid={`button-run-${t.id}`}>
                            <Play className="h-4 w-4 mr-1" /> Run now
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(t)}
                            data-testid={`button-edit-${t.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(t.id, t.active)}
                            title={t.active ? "Pause" : "Resume"} data-testid={`button-toggle-${t.id}`}>
                            <Power className={`h-4 w-4 ${t.active ? "text-green-600" : "text-muted-foreground"}`} />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Delete this template?")) del.mutate({ templateId: t.id }); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
