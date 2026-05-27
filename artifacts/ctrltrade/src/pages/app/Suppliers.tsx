import { useState } from "react";
import {
  useListSuppliers,
  useCreateSupplier,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AppSuppliers() {
  const { data, isLoading } = useListSuppliers();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const create = useCreateSupplier({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
        toast({ title: "Supplier created" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Suppliers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-supplier">
              <Plus className="h-4 w-4 mr-2" /> New Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none">
            <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Supplier</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  data: {
                    name: String(fd.get("name") ?? "").trim(),
                    contactName: (fd.get("contactName") as string) || undefined,
                    email: (fd.get("email") as string) || undefined,
                    phone: (fd.get("phone") as string) || undefined,
                    accountReference: (fd.get("accountReference") as string) || undefined,
                    paymentTermsDays: parseInt(String(fd.get("paymentTermsDays") ?? "30"), 10),
                    notes: (fd.get("notes") as string) || undefined,
                  },
                });
              }}
              className="space-y-3"
            >
              <div><Label>Name</Label><Input name="name" required data-testid="input-supplier-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact</Label><Input name="contactName" /></div>
                <div><Label>Account ref</Label><Input name="accountReference" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" /></div>
                <div><Label>Phone</Label><Input name="phone" /></div>
              </div>
              <div><Label>Payment terms (days)</Label><Input name="paymentTermsDays" type="number" defaultValue="30" /></div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <Truck className="h-5 w-5" /> Supply partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No suppliers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead><TableHead>Phone</TableHead>
                  <TableHead className="text-right">Terms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id} data-testid={`row-supplier-${s.id}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contactName ?? "—"}</TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.paymentTermsDays}d</TableCell>
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
