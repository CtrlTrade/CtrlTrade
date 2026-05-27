import { useState, useRef, useCallback } from "react";
import {
  useListSupplierOrders,
  useCreateSupplierOrder,
  useListSuppliers,
  useListProducts,
  useListStockLocations,
  getListSupplierOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ClipboardList,
  Scan,
  Loader2,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

interface ScannedReceiptResult {
  supplierName: string | null;
  supplierNameConfidence: number;
  date: string | null;
  dateConfidence: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitCostPence: number;
    confidence: number;
  }>;
  totalPence: number | null;
  totalConfidence: number;
  rawText: string;
  fileName: string | null;
}

interface LineItemRow {
  productId: string;
  description: string;
  quantity: number;
  unitCostPence: number;
  confidence?: number;
}

const CONFIDENCE_THRESHOLD = 0.75;

function ConfidenceField({
  confidence,
  children,
}: {
  confidence?: number;
  children: React.ReactNode;
}) {
  const isLow = confidence !== undefined && confidence < CONFIDENCE_THRESHOLD;
  if (!isLow) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="ring-2 ring-amber-400 ring-offset-1 rounded-sm">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-amber-700 text-white text-xs">
        <AlertTriangle className="inline h-3 w-3 mr-1" />
        Low confidence ({Math.round(confidence * 100)}%) — please verify
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSupplierOrders() {
  const { data: orders, isLoading } = useListSupplierOrders();
  const { data: suppliers } = useListSuppliers();
  const { data: products } = useListProducts();
  const { data: locations } = useListStockLocations();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { uploadFile } = useUpload();

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedReceiptResult | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { productId: "", description: "", quantity: 1, unitCostPence: 0 },
  ]);
  const [supplierNameConf, setSupplierNameConf] = useState<number | undefined>();
  const [dateConf, setDateConf] = useState<number | undefined>();

  const resetForm = useCallback(() => {
    setSupplierId("");
    setLocationId("");
    setNotes("");
    setExpectedAt("");
    setLineItems([{ productId: "", description: "", quantity: 1, unitCostPence: 0 }]);
    setScanResult(null);
    setScannedFile(null);
    setSupplierNameConf(undefined);
    setDateConf(undefined);
  }, []);

  const create = useCreateSupplierOrder({
    mutation: {
      onSuccess: async (order) => {
        qc.invalidateQueries({ queryKey: getListSupplierOrdersQueryKey() });
        toast({ title: `Purchase order ${order.number} created` });

        // Attach scanned receipt to the new PO
        if (scannedFile) {
          try {
            const uploadResult = await uploadFile(scannedFile);
            if (uploadResult?.uploadURL) {
              await fetch("/api/v1/files", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  url: uploadResult.uploadURL,
                  kind: "receipt",
                  parentKind: "supplier_order",
                  parentId: order.id,
                  name: scannedFile.name,
                  mimeType: scannedFile.type,
                  sizeBytes: scannedFile.size,
                }),
              });
              toast({ title: "Receipt attached to purchase order" });
            }
          } catch (err) {
            toast({
              title: "Receipt upload failed",
              description: "The PO was created but the receipt could not be attached.",
              variant: "destructive",
            });
          }
        }

        setOpen(false);
        resetForm();
      },
      onError: (e: Error) =>
        toast({ title: "Failed to create PO", description: e.message, variant: "destructive" }),
    },
  });

  const handleScanClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setScanning(true);
    setScanResult(null);
    setScannedFile(file);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const resp = await fetch("/api/v1/pos-catalog/supplier-orders/scan-receipt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: dataUrl,
          mimeType: file.type,
          fileName: file.name,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Scan failed (${resp.status})`);
      }

      const result: ScannedReceiptResult = await resp.json();
      setScanResult(result);

      // Pre-fill form fields
      if (result.supplierName) {
        const match = suppliers?.find(
          (s) => s.name.toLowerCase().includes(result.supplierName!.toLowerCase()) ||
                 result.supplierName!.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (match) setSupplierId(match.id);
        setSupplierNameConf(result.supplierNameConfidence);
      }

      if (result.date) {
        setExpectedAt(result.date);
        setDateConf(result.dateConfidence);
      }

      if (result.lineItems && result.lineItems.length > 0) {
        setLineItems(
          result.lineItems.map((item) => ({
            productId: "",
            description: item.description,
            quantity: item.quantity,
            unitCostPence: item.unitCostPence,
            confidence: item.confidence,
          })),
        );
      }

      toast({ title: "Receipt scanned", description: "Form pre-filled — please review and confirm." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast({ title: "Scan failed", description: msg, variant: "destructive" });
      setScannedFile(null);
    } finally {
      setScanning(false);
    }
  };

  const addLineItem = () =>
    setLineItems((prev) => [
      ...prev,
      { productId: "", description: "", quantity: 1, unitCostPence: 0 },
    ]);

  const removeLineItem = (i: number) =>
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));

  const updateLineItem = (i: number, field: keyof LineItemRow, value: string | number) =>
    setLineItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast({ title: "Select a supplier", variant: "destructive" });
      return;
    }
    const validItems = lineItems.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    create.mutate({
      data: {
        supplierId,
        locationId: locationId || null,
        notes: notes || null,
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        items: validItems.map((i) => ({
          productId: i.productId || (products?.[0]?.id ?? "00000000-0000-0000-0000-000000000000"),
          description: i.description,
          quantity: Math.max(1, Math.round(i.quantity)),
          unitCostPence: Math.round(i.unitCostPence),
          sku: null,
        })),
      },
    });
  };

  const statusColors: Record<string, string> = {
    draft: "secondary",
    sent: "outline",
    received: "default",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Purchase Orders</h1>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="rounded-none uppercase tracking-wider font-bold"
              data-testid="button-new-po"
            >
              <Plus className="h-4 w-4 mr-2" /> New PO
            </Button>
          </DialogTrigger>

          <DialogContent className="rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tighter">New Purchase Order</DialogTitle>
            </DialogHeader>

            {/* Scan receipt banner */}
            <div className="border border-dashed border-border p-4 bg-muted/30 space-y-2">
              <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Scan receipt to auto-fill
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none uppercase tracking-wider font-bold"
                  onClick={handleScanClick}
                  disabled={scanning}
                  data-testid="button-scan-receipt"
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Scan className="h-4 w-4 mr-2" />
                  )}
                  {scanning ? "Scanning…" : "Scan receipt"}
                </Button>

                {scanResult && (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                    <span>✓ Receipt scanned</span>
                    {scannedFile && (
                      <span className="text-muted-foreground text-xs truncate max-w-[160px]">
                        {scannedFile.name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult(null);
                        setScannedFile(null);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden file input — supports camera capture on mobile */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {scanResult?.rawText && (
                <p className="text-xs text-muted-foreground line-clamp-2">{scanResult.rawText}</p>
              )}

              {scanResult && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Fields highlighted in yellow have low confidence — please review them carefully.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label>Supplier *</Label>
                  <ConfidenceField confidence={supplierId ? undefined : supplierNameConf}>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      required
                      className="w-full border border-input bg-background px-3 py-2 text-sm"
                      data-testid="select-supplier"
                    >
                      <option value="">Select supplier…</option>
                      {suppliers?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </ConfidenceField>
                  {scanResult?.supplierName && !supplierId && (
                    <p className="text-xs text-amber-600 mt-1">
                      Detected: "{scanResult.supplierName}" — no exact match found, please select manually.
                    </p>
                  )}
                </div>

                <div>
                  <Label>Deliver to location</Label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Any location</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Expected date</Label>
                  <ConfidenceField confidence={expectedAt ? dateConf : undefined}>
                    <Input
                      type="date"
                      value={expectedAt}
                      onChange={(e) => setExpectedAt(e.target.value)}
                    />
                  </ConfidenceField>
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line items *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none uppercase tracking-wider font-bold text-xs"
                    onClick={addLineItem}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add item
                  </Button>
                </div>

                <div className="border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-20 text-right">Qty</TableHead>
                        <TableHead className="w-28 text-right">Unit cost (£)</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, i) => (
                        <TableRow key={i} data-testid={`row-line-item-${i}`}>
                          <TableCell className="p-1">
                            <ConfidenceField confidence={item.confidence}>
                              <Input
                                value={item.description}
                                onChange={(e) => updateLineItem(i, "description", e.target.value)}
                                placeholder="Description"
                                className="rounded-none border-0 focus-visible:ring-0 px-2"
                                data-testid={`input-line-desc-${i}`}
                              />
                            </ConfidenceField>
                          </TableCell>
                          <TableCell className="p-1">
                            <ConfidenceField confidence={item.confidence}>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateLineItem(i, "quantity", parseFloat(e.target.value) || 1)}
                                className="rounded-none border-0 focus-visible:ring-0 px-2 text-right"
                                data-testid={`input-line-qty-${i}`}
                              />
                            </ConfidenceField>
                          </TableCell>
                          <TableCell className="p-1">
                            <ConfidenceField confidence={item.confidence}>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={(item.unitCostPence / 100).toFixed(2)}
                                onChange={(e) =>
                                  updateLineItem(i, "unitCostPence", Math.round(parseFloat(e.target.value || "0") * 100))
                                }
                                className="rounded-none border-0 focus-visible:ring-0 px-2 text-right"
                                data-testid={`input-line-cost-${i}`}
                              />
                            </ConfidenceField>
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-none h-7 w-7 p-0"
                              onClick={() => removeLineItem(i)}
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end text-sm font-bold">
                  Total: £
                  {(
                    lineItems.reduce((sum, i) => sum + i.quantity * i.unitCostPence, 0) / 100
                  ).toFixed(2)}
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-none"
                />
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-none uppercase tracking-wider font-bold"
                  data-testid="button-create-po"
                >
                  {create.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Create PO
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : !orders || orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No purchase orders yet. Create one or scan a receipt to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} data-testid={`row-po-${o.id}`}>
                    <TableCell className="font-mono font-bold text-sm">{o.number}</TableCell>
                    <TableCell>{o.supplierName}</TableCell>
                    <TableCell>
                      <Badge variant={(statusColors[o.status] as any) ?? "outline"} className="rounded-none uppercase text-xs">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">£{(o.subtotalPence / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.expectedAt ? new Date(o.expectedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
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
