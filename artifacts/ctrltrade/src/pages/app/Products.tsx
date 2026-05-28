import { useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useListProductCategories,
  useCreateProductCategory,
  useListSuppliers,
  getListProductsQueryKey,
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
import { Plus, Package, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AppProducts() {
  const { data, isLoading } = useListProducts();
  const { data: categories } = useListProductCategories();
  const { data: suppliers } = useListSuppliers();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const create = useCreateProduct({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product created" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });
  const createCat = useCreateProductCategory({
    mutation: {
      onSuccess: () => { qc.invalidateQueries(); toast({ title: "Category created" }); setCatOpen(false); },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const priceFloat = parseFloat(String(fd.get("price") ?? "0")) || 0;
    const tradeStr = String(fd.get("tradePrice") ?? "").trim();
    const costStr = String(fd.get("cost") ?? "").trim();
    create.mutate({
      data: {
        sku: String(fd.get("sku") ?? "").trim(),
        name: String(fd.get("name") ?? "").trim(),
        description: (fd.get("description") as string) || undefined,
        unit: String(fd.get("unit") ?? "each"),
        pricePence: Math.round(priceFloat * 100),
        costPence: costStr ? Math.round(parseFloat(costStr) * 100) : 0,
        tradePricePence: tradeStr ? Math.round(parseFloat(tradeStr) * 100) : undefined,
        vatRatePct: parseInt(String(fd.get("vat") ?? "20"), 10),
        barcode: (fd.get("barcode") as string) || undefined,
        trackStock: fd.get("trackStock") === "on",
        reorderLevel: parseInt(String(fd.get("reorderLevel") ?? "0"), 10),
        reorderQty: parseInt(String(fd.get("reorderQty") ?? "0"), 10),
        categoryId: (fd.get("categoryId") as string) || undefined,
        supplierId: (fd.get("supplierId") as string) || undefined,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter">Products</h1>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-category">
                <Tag className="h-4 w-4 mr-2" /> Category
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none">
              <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Category</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createCat.mutate({ data: { name: String(fd.get("name") ?? "").trim() } });
                }}
                className="space-y-3"
              >
                <div><Label>Name</Label><Input name="name" required data-testid="input-category-name" /></div>
                <DialogFooter>
                  <Button type="submit" disabled={createCat.isPending} className="rounded-none uppercase tracking-wider font-bold">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-product">
                <Plus className="h-4 w-4 mr-2" /> New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none max-w-2xl">
              <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Product</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SKU</Label><Input name="sku" required data-testid="input-product-sku" /></div>
                  <div><Label>Barcode</Label><Input name="barcode" data-testid="input-product-barcode" /></div>
                </div>
                <div><Label>Name</Label><Input name="name" required data-testid="input-product-name" /></div>
                <div><Label>Description</Label><Textarea name="description" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Price (£)</Label><Input name="price" type="number" step="0.01" required data-testid="input-product-price" /></div>
                  <div><Label>Trade £</Label><Input name="tradePrice" type="number" step="0.01" /></div>
                  <div><Label>Cost £</Label><Input name="cost" type="number" step="0.01" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Unit</Label><Input name="unit" defaultValue="each" /></div>
                  <div><Label>VAT %</Label><Input name="vat" type="number" defaultValue="20" /></div>
                  <div className="flex items-end gap-2 pb-2">
                    <input type="checkbox" name="trackStock" defaultChecked id="trackStock" />
                    <Label htmlFor="trackStock" className="uppercase text-xs tracking-wider">Track stock</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Reorder level</Label><Input name="reorderLevel" type="number" defaultValue="0" /></div>
                  <div><Label>Reorder qty</Label><Input name="reorderQty" type="number" defaultValue="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <select name="categoryId" className="w-full border border-input bg-background px-3 py-2 text-sm">
                      <option value="">—</option>
                      {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Supplier</Label>
                    <select name="supplierId" className="w-full border border-input bg-background px-3 py-2 text-sm">
                      <option value="">—</option>
                      {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">
                    {create.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5" /> Catalogue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-right">£{(p.pricePence / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.trackStock ? p.totalStock : "—"}</TableCell>
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
