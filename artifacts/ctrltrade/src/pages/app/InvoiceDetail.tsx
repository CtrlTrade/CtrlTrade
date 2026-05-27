import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetInvoice,
  useSendInvoice,
  useVoidInvoice,
  useMarkInvoicePaid,
  useReplaceInvoiceItems,
  getGetInvoiceQueryKey,
  getListInvoicesQueryKey,
  getGetAgedDebtorsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Ban, ExternalLink, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

interface ItemDraft { description: string; quantity: number; unitPricePence: number }

export function AppInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetInvoice(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ItemDraft[]>([]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAgedDebtorsQueryKey() });
  };

  const send = useSendInvoice({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Invoice sent" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const voidInv = useVoidInvoice({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Invoice voided" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const markPaid = useMarkInvoicePaid({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Marked paid" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const replaceItems = useReplaceInvoiceItems({
    mutation: {
      onSuccess: () => { invalidate(); setEditing(false); toast({ title: "Items updated" }); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Invoice not found.</p>;

  const canSend = data.status === "draft";
  const canVoid = data.status !== "paid" && data.status !== "void";
  const canEdit = data.status === "draft";
  const canMarkPaid = data.status !== "paid" && data.status !== "void";

  const startEdit = () => {
    setDraftItems(data.items.map((it) => ({
      description: it.description, quantity: it.quantity, unitPricePence: it.unitPricePence,
    })));
    setEditing(true);
  };
  const updateDraft = (i: number, patch: Partial<ItemDraft>) =>
    setDraftItems((d) => d.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const addRow = () => setDraftItems((d) => [...d, { description: "", quantity: 1, unitPricePence: 0 }]);
  const removeRow = (i: number) => setDraftItems((d) => d.filter((_, idx) => idx !== i));
  const saveItems = () => {
    const items = draftItems
      .filter((it) => it.description.trim().length > 0 && it.quantity > 0)
      .map((it) => ({ description: it.description, quantity: Math.floor(it.quantity), unitPricePence: Math.floor(it.unitPricePence) }));
    replaceItems.mutate({ invoiceId: id, data: { items } });
  };
  const handleMarkPaid = () => {
    const note = window.prompt("Optional note for this manual payment (e.g. 'Cash on site'):") ?? undefined;
    markPaid.mutate({ invoiceId: id, data: { note } });
  };

  const draftSubtotal = draftItems.reduce((s, it) => s + (it.quantity * it.unitPricePence), 0);
  const draftTax = Math.round((draftSubtotal * data.vatRatePct) / 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/invoices" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          <p className="text-sm mt-1">Customer: <span className="font-medium">{data.customerName}</span></p>
          {data.isDeposit && <Badge variant="secondary" className="uppercase mt-2">Deposit invoice</Badge>}
        </div>
        <Badge variant={STATUS_VARIANT[data.status] ?? "outline"} className="uppercase" data-testid="badge-invoice-status">{data.status}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send.mutate({ invoiceId: id })} disabled={!canSend || send.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-send-invoice">
          <Send className="h-4 w-4 mr-2" /> Send & request payment
        </Button>
        {data.paymentLinkUrl && (
          <a href={data.paymentLinkUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-payment-link">
              <ExternalLink className="h-4 w-4 mr-2" /> Open payment link
            </Button>
          </a>
        )}
        <Button onClick={handleMarkPaid} disabled={!canMarkPaid || markPaid.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-mark-paid">
          <Check className="h-4 w-4 mr-2" /> Mark paid
        </Button>
        <Button onClick={() => { if (confirm("Void this invoice?")) voidInv.mutate({ invoiceId: id }); }}
          disabled={!canVoid || voidInv.isPending}
          variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-void-invoice">
          <Ban className="h-4 w-4 mr-2" /> Void
        </Button>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="uppercase tracking-tight">Line items</CardTitle>
            {canEdit && !editing && (
              <Button variant="outline" size="sm" onClick={startEdit}
                className="rounded-none uppercase tracking-wider text-xs font-bold" data-testid="button-edit-items">
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              {draftItems.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="rounded-none col-span-7" value={it.description}
                    placeholder="Description"
                    onChange={(e) => updateDraft(i, { description: e.target.value })}
                    data-testid={`input-item-desc-${i}`} />
                  <Input className="rounded-none col-span-2 font-mono" type="number" min={1} value={it.quantity}
                    onChange={(e) => updateDraft(i, { quantity: Number(e.target.value) || 0 })}
                    data-testid={`input-item-qty-${i}`} />
                  <Input className="rounded-none col-span-2 font-mono" type="number" min={0} value={it.unitPricePence}
                    onChange={(e) => updateDraft(i, { unitPricePence: Number(e.target.value) || 0 })}
                    placeholder="Pence"
                    data-testid={`input-item-price-${i}`} />
                  <Button variant="ghost" size="sm" onClick={() => removeRow(i)} className="col-span-1">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow}
                className="rounded-none uppercase tracking-wider text-xs font-bold" data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" /> Add line
              </Button>
              <div className="text-sm text-muted-foreground border-t pt-2 space-y-1">
                <div>Subtotal: <span className="font-mono">{formatGBP(draftSubtotal)}</span></div>
                <div>VAT ({data.vatRatePct}%): <span className="font-mono">{formatGBP(draftTax)}</span></div>
                <div className="font-bold">Total: <span className="font-mono">{formatGBP(draftSubtotal + draftTax)}</span></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveItems} disabled={replaceItems.isPending}
                  className="rounded-none uppercase tracking-wider font-bold" data-testid="button-save-items">
                  Save
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}
                  className="rounded-none uppercase tracking-wider font-bold">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(it.unitPricePence)}</TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(it.quantity * it.unitPricePence)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right uppercase text-muted-foreground">Subtotal</TableCell>
                  <TableCell className="text-right font-mono">{formatGBP(data.subtotalPence)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right uppercase text-muted-foreground">VAT ({data.vatRatePct}%)</TableCell>
                  <TableCell className="text-right font-mono">{formatGBP(data.taxPence)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold uppercase">Total</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatGBP(data.totalPence)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          {data.notes && !editing && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{data.notes}</p>}
        </CardContent>
      </Card>

      {data.payments.length > 0 && (
        <Card className=" border-border shadow-sm">
          <CardHeader><CardTitle className="uppercase tracking-tight">Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.receivedAt).toLocaleString("en-GB")}</TableCell>
                    <TableCell className="uppercase text-xs">{p.provider}</TableCell>
                    <TableCell className="uppercase text-xs">{p.status}</TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(p.amountPence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
