import { useState } from "react";
import {
  useListBranchStock,
  useListStockLocations,
  useCreateStockLocation,
  useAdjustStock,
  useTransferStock,
  useListLowStock,
  useListProducts,
  getListBranchStockQueryKey,
  getListLowStockQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Warehouse, AlertTriangle, ArrowLeftRight, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AppStock() {
  const { data: stock, isLoading } = useListBranchStock();
  const { data: locations } = useListStockLocations();
  const { data: low } = useListLowStock();
  const { data: products } = useListProducts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [locOpen, setLocOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListBranchStockQueryKey() });
    qc.invalidateQueries({ queryKey: getListLowStockQueryKey() });
  };

  const createLoc = useCreateStockLocation({
    mutation: {
      onSuccess: () => { qc.invalidateQueries(); toast({ title: "Location created" }); setLocOpen(false); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const adjust = useAdjustStock({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock adjusted" }); setAdjOpen(false); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const transfer = useTransferStock({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock transferred" }); setTransferOpen(false); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Stock</h1>
        <div className="flex gap-2">
          <Dialog open={locOpen} onOpenChange={setLocOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-location">
                <Plus className="h-4 w-4 mr-2" /> Location
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Location</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createLoc.mutate({
                    data: {
                      name: String(fd.get("name") ?? "").trim(),
                      kind: String(fd.get("kind") ?? "shop"),
                      code: (fd.get("code") as string) || undefined,
                      city: (fd.get("city") as string) || undefined,
                      postcode: (fd.get("postcode") as string) || undefined,
                      isDefault: fd.get("isDefault") === "on",
                    },
                  });
                }}
                className="space-y-3"
              >
                <div><Label>Name</Label><Input name="name" required data-testid="input-location-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kind</Label>
                    <select name="kind" className="w-full border border-input bg-background px-3 py-2 text-sm">
                      <option value="shop">Shop</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="van">Van</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div><Label>Code</Label><Input name="code" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>City</Label><Input name="city" /></div>
                  <div><Label>Postcode</Label><Input name="postcode" /></div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isDefault" id="isDefault" />
                  <Label htmlFor="isDefault" className="uppercase text-xs tracking-wider">Default location</Label>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createLoc.isPending} className="rounded-none uppercase tracking-wider font-bold">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-adjust-stock">
                <Settings2 className="h-4 w-4 mr-2" /> Adjust
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle className="uppercase tracking-tighter">Adjust Stock</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  adjust.mutate({
                    data: {
                      locationId: String(fd.get("locationId")),
                      productId: String(fd.get("productId")),
                      qtyDelta: parseInt(String(fd.get("qty") ?? "0"), 10),
                      reason: String(fd.get("reason") ?? "adjustment"),
                      note: (fd.get("note") as string) || undefined,
                    },
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <Label>Location</Label>
                  <select name="locationId" required className="w-full border border-input bg-background px-3 py-2 text-sm">
                    {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Product</Label>
                  <select name="productId" required className="w-full border border-input bg-background px-3 py-2 text-sm">
                    {products?.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Qty change (±)</Label><Input name="qty" type="number" required defaultValue="1" /></div>
                  <div>
                    <Label>Reason</Label>
                    <select name="reason" className="w-full border border-input bg-background px-3 py-2 text-sm">
                      <option value="adjustment">Adjustment</option>
                      <option value="count">Stock count</option>
                      <option value="damage">Damage</option>
                      <option value="loss">Loss</option>
                    </select>
                  </div>
                </div>
                <div><Label>Note</Label><Input name="note" /></div>
                <DialogFooter>
                  <Button type="submit" disabled={adjust.isPending} className="rounded-none uppercase tracking-wider font-bold">Apply</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-transfer-stock">
                <ArrowLeftRight className="h-4 w-4 mr-2" /> Transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle className="uppercase tracking-tighter">Transfer Stock</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  transfer.mutate({
                    data: {
                      fromLocationId: String(fd.get("fromLocationId")),
                      toLocationId: String(fd.get("toLocationId")),
                      items: [{
                        productId: String(fd.get("productId")),
                        quantity: parseInt(String(fd.get("qty") ?? "1"), 10),
                      }],
                      note: (fd.get("note") as string) || undefined,
                    },
                  });
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From</Label>
                    <select name="fromLocationId" required className="w-full border border-input bg-background px-3 py-2 text-sm">
                      {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>To</Label>
                    <select name="toLocationId" required className="w-full border border-input bg-background px-3 py-2 text-sm">
                      {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Product</Label>
                  <select name="productId" required className="w-full border border-input bg-background px-3 py-2 text-sm">
                    {products?.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                </div>
                <div><Label>Qty</Label><Input name="qty" type="number" required defaultValue="1" /></div>
                <div><Label>Note</Label><Input name="note" /></div>
                <DialogFooter>
                  <Button type="submit" disabled={transfer.isPending} className="rounded-none uppercase tracking-wider font-bold">Transfer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {low && low.length > 0 && (
        <Card className="rounded-none border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Low stock — {low.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reorder at</TableHead><TableHead>Supplier</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {low.map((r) => (
                  <TableRow key={r.productId} data-testid={`row-low-${r.productId}`}>
                    <TableCell className="font-mono text-xs">{r.productSku}</TableCell>
                    <TableCell className="font-medium">{r.productName}</TableCell>
                    <TableCell className="text-right">{r.totalQty}</TableCell>
                    <TableCell className="text-right">{r.reorderLevel}</TableCell>
                    <TableCell>{r.supplierName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <Warehouse className="h-5 w-5" /> Stock by location
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !stock || stock.length === 0 ? (
            <p className="text-muted-foreground text-sm">No stock yet — add products and receive supplier orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((r) => (
                  <TableRow key={r.id} data-testid={`row-stock-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.productSku}</TableCell>
                    <TableCell className="font-medium">{r.productName}</TableCell>
                    <TableCell>{r.locationName}</TableCell>
                    <TableCell className={`text-right font-bold ${r.qty <= (r.reorderLevel ?? 0) ? "text-amber-600" : ""}`}>{r.qty}</TableCell>
                    <TableCell className="text-right text-xs">{r.reorderLevel ?? 0}</TableCell>
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
