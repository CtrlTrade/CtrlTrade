import { useState } from "react";
import { Link } from "wouter";
import {
  useListQuotes,
  useCreateQuote,
  useListCustomers,
  getListQuotesQueryKey,
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
import { Plus, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LineItem = { description: string; quantity: number; unitPricePence: number };

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  accepted: "default",
  declined: "outline",
  converted: "default",
};

export function AppQuotes() {
  const { data, isLoading } = useListQuotes();
  const { data: customers } = useListCustomers();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPricePence: 0 }]);
  const create = useCreateQuote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: "Quote created" });
        setOpen(false);
        setCustomerId(""); setTitle(""); setNotes("");
        setItems([{ description: "", quantity: 1, unitPricePence: 0 }]);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    create.mutate({
      data: {
        customerId,
        title,
        notes: notes || undefined,
        items: items.filter((i) => i.description.trim() !== ""),
      },
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Quotes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold" data-testid="button-new-quote">
              <Plus className="h-4 w-4 mr-2" /> New Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl max-w-2xl">
            <DialogHeader><DialogTitle className="">New Quote</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Select customer…" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
              <div>
                <Label>Line items</Label>
                <div className="space-y-2 mt-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_120px_40px] gap-2 items-end">
                      <Input placeholder="Description" value={it.description}
                        onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                      <Input type="number" min={1} value={it.quantity}
                        onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                      <Input type="number" min={0} placeholder="Pence" value={it.unitPricePence}
                        onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, unitPricePence: Number(e.target.value) } : x))} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems((s) => [...s, { description: "", quantity: 1, unitPricePence: 0 }])} className="rounded-xl">
                    + Add item
                  </Button>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || !customerId} className="rounded-xl font-bold">
                  {create.isPending ? "Saving…" : "Save quote"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className=" flex items-center gap-2"><FileText className="h-5 w-5" /> All quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quotes yet.</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead><TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((q) => (
                  <TableRow key={q.id} data-testid={`row-quote-${q.id}`}>
                    <TableCell className="font-mono">
                      <Link href={`/app/quotes/${q.id}`} className="hover:underline">{q.number}</Link>
                    </TableCell>
                    <TableCell>{q.title}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[q.status] ?? "outline"} className="">{q.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatGBP(q.totalPence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
