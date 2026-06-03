/**
 * CtrlTradePos® — Web Till Screen (Steps 85 & 86)
 *
 * Step 85: Touchscreen & kiosk UI
 *   - Full-screen / kiosk mode toggle
 *   - Large touch-friendly targets (min 48px)
 *   - On-screen numpad
 *   - Light/dark toggle
 *   - PWA install prompt
 *
 * Step 86: POS operating modes
 *   - Trade Counter — fast checkout, barcode, trade-account lookup
 *   - Showroom — product display, consultation, deposit quote
 *   - Warehouse — goods-in/out, picking, packing, transfers
 */

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { useLocation } from "wouter";
import {
  useListProducts,
  useGetCurrentTillSession,
  useOpenTillSession,
  useCreatePosSale,
  useValidatePosLicence,
  useListPosTradeAccounts,
  posLogin,
  setAuthTokenGetter,
} from "@workspace/api-client-react";
import {
  getPosHardware,
  setupPwaInstallPrompt,
  promptPwaInstall,
  isPwaInstallable,
  isPwaInstalled,
  getOfflineQueue,
  flushOfflineQueue,
} from "@/lib/posHardware";
import {
  ShoppingCart,
  Search,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Download,
  Printer,
  ScanBarcode,
  CreditCard,
  Banknote,
  Users,
  Package,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  AlertTriangle,
  X,
  Monitor,
  Warehouse,
  Store,
  Settings,
  Plug,
  PlugZap,
  Usb,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalMode = "trade_counter" | "showroom" | "warehouse";

interface CartLine {
  productId: string;
  sku: string;
  name: string;
  unitPricePence: number;
  qty: number;
  vatRatePct: number;
}

type TenderType = "cash" | "card" | "trade_account";

interface PaymentState {
  tenderType: TenderType;
  amountTenderedPence: number;
  tradeAccountId: string | null;
}

type View = "till" | "payment" | "receipt";

/** Licence type returned by the validation endpoint. */
type LicenceType = "web" | "desktop" | "hybrid";

/**
 * Hardware capabilities derived from the licence type.
 *
 *  web      → keyboard-wedge barcode only, window.print() receipt, no USB/HID/Serial
 *  desktop  → full hardware (WebUSB printer+drawer, WebHID scanner, WebSerial, customer display)
 *  hybrid   → same as desktop
 */
interface HardwareCapabilities {
  usbPrinter: boolean;
  hidScanner: boolean;
  serialScanner: boolean;
  customerDisplay: boolean;
}

/**
 * Derive hardware capabilities from a validated licence type.
 *
 * This till always validates with surface:"web", so:
 *  - web     → basic capability (keyboard-wedge scanner, window.print receipt)
 *  - hybrid  → full hardware (WebUSB printer/drawer, WebHID/WebSerial scanner, customer display)
 *              A hybrid licence is accepted on both web and desktop surfaces by the server.
 *  - desktop → server rejects with "desktop POS only" on web surface; never reaches
 *              capability evaluation. Mapped to basic so stale localStorage state is safe.
 */
function getHwCapabilities(licenceType: LicenceType): HardwareCapabilities {
  const full = licenceType === "hybrid";
  return {
    usbPrinter: full && "usb" in navigator,
    hidScanner: full && "hid" in navigator,
    serialScanner: full && "serial" in navigator,
    customerDisplay: full,
  };
}

/** Provides the active licence type to child components inside LicenceGate. */
const LicenceCtx = createContext<LicenceType>("web");
function useLicenceType() {
  return useContext(LicenceCtx);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.unitPricePence * l.qty, 0);
}

function cartTax(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + Math.round(l.unitPricePence * l.qty * (l.vatRatePct / 100)), 0);
}

function cartTotal(lines: CartLine[]): number {
  return cartSubtotal(lines) + cartTax(lines);
}

// ---------------------------------------------------------------------------
// Numpad
// ---------------------------------------------------------------------------

function Numpad({
  value,
  onChange,
  onEnter,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onClear?: () => void;
}) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

  const press = (k: string) => {
    if (k === "⌫") {
      onChange(value.slice(0, -1));
    } else {
      if (k === "." && value.includes(".")) return;
      onChange(value + k);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onPointerDown={() => press(k)}
          className="h-14 rounded-xl text-xl font-bold bg-card border border-border hover:bg-muted active:scale-95 transition-all touch-manipulation select-none"
          data-testid={`numpad-${k === "⌫" ? "backspace" : k}`}
        >
          {k}
        </button>
      ))}
      {onClear && (
        <button
          onPointerDown={onClear}
          className="col-span-3 h-12 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 active:scale-95 transition-all touch-manipulation"
          data-testid="numpad-clear"
        >
          Clear
        </button>
      )}
      {onEnter && (
        <button
          onPointerDown={onEnter}
          className="col-span-3 h-14 rounded-xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all touch-manipulation"
          data-testid="numpad-enter"
        >
          Confirm
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cart panel
// ---------------------------------------------------------------------------

function CartPanel({
  lines,
  onQtyChange,
  onRemove,
  onCheckout,
  mode,
  disabled,
}: {
  lines: CartLine[];
  onQtyChange: (idx: number, delta: number) => void;
  onRemove: (idx: number) => void;
  onCheckout: () => void;
  mode: TerminalMode;
  disabled: boolean;
}) {
  const subtotal = cartSubtotal(lines);
  const tax = cartTax(lines);
  const total = cartTotal(lines);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border" data-testid="cart-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm uppercase tracking-wider">
          {mode === "warehouse" ? "Pick List" : "Cart"}
        </span>
        {lines.length > 0 && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {lines.reduce((s, l) => s + l.qty, 0)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
            <ShoppingCart className="h-12 w-12 opacity-20" />
            <p className="text-sm text-center">
              {mode === "warehouse" ? "Scan items to pick" : "Scan or tap a product"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {lines.map((line, i) => (
              <div key={`${line.productId}-${i}`} className="px-4 py-3" data-testid={`cart-line-${i}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{line.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{line.sku}</div>
                  </div>
                  <button
                    onPointerDown={() => onRemove(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors touch-manipulation p-1"
                    data-testid={`remove-line-${i}`}
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onPointerDown={() => onQtyChange(i, -1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted active:scale-90 transition-all touch-manipulation"
                      data-testid={`qty-dec-${i}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-sm font-semibold">{line.qty}</span>
                    <button
                      onPointerDown={() => onQtyChange(i, 1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted active:scale-90 transition-all touch-manipulation"
                      data-testid={`qty-inc-${i}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">{money(line.unitPricePence * line.qty)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="border-t border-border p-4 space-y-2 shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal (ex. VAT)</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>VAT</span>
            <span>{money(tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
            <span>TOTAL</span>
            <span>{money(total)}</span>
          </div>
          <button
            onPointerDown={onCheckout}
            disabled={disabled}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all touch-manipulation disabled:opacity-50 mt-2"
            data-testid="checkout-button"
          >
            {mode === "warehouse" ? "CONFIRM PICK" : "CHECKOUT"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product grid
// ---------------------------------------------------------------------------

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  pricePence: number;
  vatRatePct: number;
  categoryName?: string | null;
  barcode?: string | null;
};

function ProductGrid({
  products,
  search,
  onSelect,
  mode,
}: {
  products: ProductRow[];
  search: string;
  onSelect: (p: ProductRow) => void;
  mode: TerminalMode;
}) {
  const q = search.toLowerCase();
  const filtered = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q),
      )
    : products;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
        <Package className="h-16 w-16 opacity-20" />
        <p className="text-sm">{q ? "No products match that search" : "No products in catalogue"}</p>
      </div>
    );
  }

  const cols = mode === "showroom" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid ${cols} gap-3 auto-rows-fr`}>
      {filtered.map((p) => (
        <button
          key={p.id}
          onPointerDown={() => onSelect(p)}
          className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 hover:bg-muted/60 active:scale-95 transition-all touch-manipulation text-left min-h-[90px]"
          data-testid={`product-${p.id}`}
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mb-1 shrink-0">
            <Package className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-sm font-semibold leading-tight line-clamp-2 flex-1">{p.name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>
          {mode === "showroom" && p.categoryName && (
            <div className="text-[10px] text-muted-foreground">{p.categoryName}</div>
          )}
          <div className="text-sm font-bold text-primary">{money(p.pricePence)}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warehouse panel
// ---------------------------------------------------------------------------

function WarehousePanel({
  products,
  search,
  onAddLine,
}: {
  products: ProductRow[];
  search: string;
  onAddLine: (p: ProductRow, qty: number, type: "in" | "out" | "transfer") => void;
}) {
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [qty, setQty] = useState("1");
  const [txType, setTxType] = useState<"in" | "out" | "transfer">("out");

  const confirm = () => {
    if (!selected) return;
    onAddLine(selected, parseInt(qty, 10) || 1, txType);
    setSelected(null);
    setQty("1");
  };

  const q = search.toLowerCase();
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    : products;

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onPointerDown={() => setSelected(p)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all touch-manipulation text-left ${
                selected?.id === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
              data-testid={`wh-product-${p.id}`}
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-xs font-mono text-muted-foreground">{p.sku}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="w-64 shrink-0 flex flex-col gap-4 bg-card border border-border rounded-xl p-4">
          <div>
            <div className="text-sm font-semibold">{selected.name}</div>
            <div className="text-xs font-mono text-muted-foreground">{selected.sku}</div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["out", "in", "transfer"] as const).map((t) => (
              <button
                key={t}
                onPointerDown={() => setTxType(t)}
                className={`h-9 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                  txType === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                }`}
              >
                {t === "out" ? "PICK" : t === "in" ? "GOODS IN" : "XFER"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <Numpad value={qty} onChange={setQty} onEnter={confirm} />
          </div>
          <button
            onPointerDown={confirm}
            className="h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all touch-manipulation"
          >
            CONFIRM
          </button>
          <button
            onPointerDown={() => setSelected(null)}
            className="h-10 rounded-xl border border-border text-sm hover:bg-muted transition-all touch-manipulation"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment screen
// ---------------------------------------------------------------------------

type TradeAccountRow = {
  id: string;
  name: string;
  creditLimitPence: number;
};

function PaymentScreen({
  totalPence,
  tradeAccounts,
  onComplete,
  onBack,
}: {
  totalPence: number;
  tradeAccounts: TradeAccountRow[];
  onComplete: (payment: PaymentState) => void;
  onBack: () => void;
}) {
  const [tender, setTender] = useState<TenderType>("cash");
  const [cashStr, setCashStr] = useState("");
  const [tradeAccountId, setTradeAccountId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const hw = getPosHardware();
  const cashPence = Math.round(parseFloat(cashStr || "0") * 100);
  const changePence = Math.max(0, cashPence - totalPence);

  const handlePay = async () => {
    if (tender === "cash" && cashPence < totalPence) return;
    if (tender === "trade_account" && !tradeAccountId) return;

    setProcessing(true);

    if (tender === "card") {
      await hw.cardTerminal.requestPayment({ amountPence: totalPence });
    }

    onComplete({
      tenderType: tender,
      amountTenderedPence: tender === "cash" ? cashPence : totalPence,
      tradeAccountId,
    });
    setProcessing(false);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden" data-testid="payment-screen">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          onPointerDown={onBack}
          className="p-2 rounded-lg hover:bg-muted transition-colors touch-manipulation"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg">PAYMENT</h2>
        <span className="ml-auto text-2xl font-bold">{money(totalPence)}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tender type selection */}
        <div className="w-48 shrink-0 border-r border-border p-3 flex flex-col gap-2">
          {[
            { type: "cash" as TenderType, icon: Banknote, label: "Cash" },
            { type: "card" as TenderType, icon: CreditCard, label: "Card" },
            { type: "trade_account" as TenderType, icon: Users, label: "Account" },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onPointerDown={() => setTender(type)}
              className={`flex items-center gap-3 h-14 px-3 rounded-xl border transition-all touch-manipulation ${
                tender === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted"
              }`}
              data-testid={`tender-${type}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Payment detail */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          {tender === "cash" && (
            <>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Cash tendered</div>
                <div className="text-4xl font-bold font-mono">£{cashStr || "0.00"}</div>
                {cashPence > 0 && (
                  <div
                    className={`text-lg font-semibold mt-2 ${
                      cashPence >= totalPence ? "text-green-500" : "text-destructive"
                    }`}
                  >
                    {cashPence >= totalPence
                      ? `Change: ${money(changePence)}`
                      : `Short: ${money(totalPence - cashPence)}`}
                  </div>
                )}
              </div>
              <Numpad value={cashStr} onChange={setCashStr} onClear={() => setCashStr("")} />
              <div className="grid grid-cols-2 gap-2">
                {[500, 1000, 2000, 5000].map((p) => (
                  <button
                    key={p}
                    onPointerDown={() => setCashStr((p / 100).toFixed(2))}
                    className="h-12 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-sm active:scale-95 transition-all touch-manipulation"
                    data-testid={`quick-cash-${p}`}
                  >
                    {money(p)}
                  </button>
                ))}
              </div>
            </>
          )}

          {tender === "card" && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              <CreditCard className="h-16 w-16 text-muted-foreground opacity-40" />
              <div className="text-center">
                <div className="text-lg font-semibold">Card Payment</div>
                <div className="text-sm text-muted-foreground mt-1">Present card or device to reader</div>
                <div className="text-2xl font-bold mt-3">{money(totalPence)}</div>
              </div>
              <p className="text-xs text-muted-foreground text-center px-8">
                Card terminal integration is active. Your card reader will display the payment prompt automatically.
              </p>
            </div>
          )}

          {tender === "trade_account" && (
            <div className="space-y-3">
              <div className="text-sm font-semibold">Select trade account</div>
              {tradeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trade accounts set up.</p>
              ) : (
                <div className="grid gap-2">
                  {tradeAccounts.map((ta) => (
                    <button
                      key={ta.id}
                      onPointerDown={() => setTradeAccountId(ta.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all touch-manipulation ${
                        tradeAccountId === ta.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                      data-testid={`trade-account-${ta.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{ta.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Limit {money(ta.creditLimitPence)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <button
          onPointerDown={handlePay}
          disabled={
            processing ||
            (tender === "cash" && cashPence < totalPence) ||
            (tender === "trade_account" && !tradeAccountId)
          }
          className="w-full h-16 rounded-xl bg-green-600 text-white font-bold text-xl hover:bg-green-500 active:scale-[0.98] transition-all touch-manipulation disabled:opacity-50"
          data-testid="confirm-payment"
        >
          {processing ? "PROCESSING…" : "TAKE PAYMENT"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt view
// ---------------------------------------------------------------------------

function ReceiptView({
  lines,
  payment,
  receiptId,
  hwCaps,
  onNewSale,
}: {
  lines: CartLine[];
  payment: PaymentState;
  receiptId: string;
  hwCaps: HardwareCapabilities;
  onNewSale: () => void;
}) {
  const total = cartTotal(lines);
  const hw = getPosHardware();
  const [drawerKicked, setDrawerKicked] = useState<boolean | null>(null);

  const printReceipt = () => {
    hw.printer.print({
      title: "CtrlTradePos®",
      lines: [
        `Receipt: ${receiptId}`,
        "".padEnd(32, "-"),
        ...lines.map(
          (l) =>
            `${l.name.slice(0, 20).padEnd(20)} x${l.qty} @ ${money(l.unitPricePence)} = ${money(l.unitPricePence * l.qty)}`,
        ),
        "".padEnd(32, "-"),
        `TOTAL: ${money(total)}`,
        "",
        `Tender: ${payment.tenderType.replace("_", " ").toUpperCase()}`,
        ...(payment.tenderType === "cash"
          ? [`Change: ${money(Math.max(0, payment.amountTenderedPence - total))}`]
          : []),
      ],
      footer: "Thank you for your purchase!",
    });
  };

  useEffect(() => {
    if (payment.tenderType === "cash" && hwCaps.usbPrinter) {
      hw.cashDrawer
        .kick()
        .then((ok) => setDrawerKicked(ok))
        .catch(() => setDrawerKicked(false));
    }
    if (hwCaps.customerDisplay) {
      hw.customerDisplay.show({ top: "THANK YOU", bottom: `Total: ${money(total)}` });
    }
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 gap-6 p-8"
      data-testid="receipt-view"
    >
      <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">SALE COMPLETE</div>
        <div className="text-muted-foreground mt-1">{money(total)} received</div>
        {payment.tenderType === "cash" && (
          <div className="text-xl font-semibold text-green-500 mt-2">
            Change: {money(Math.max(0, payment.amountTenderedPence - total))}
          </div>
        )}
        {/* Cash drawer feedback — only shown when USB hardware is available */}
        {payment.tenderType === "cash" && hwCaps.usbPrinter && drawerKicked === false && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cash drawer did not open — check USB connection in Hardware Setup
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onPointerDown={printReceipt}
          className="flex items-center gap-2 h-12 px-5 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-sm active:scale-95 transition-all touch-manipulation"
          data-testid="print-receipt"
        >
          <Printer className="h-4 w-4" />
          Print Receipt
        </button>
        <button
          onPointerDown={onNewSale}
          className="flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all touch-manipulation"
          data-testid="new-sale"
        >
          NEW SALE
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hardware panel
// ---------------------------------------------------------------------------

type ConnectStatus = "idle" | "connecting" | "connected" | "error";

function HardwarePanel({
  hwCaps,
  onClose,
}: {
  hwCaps: HardwareCapabilities;
  onClose: () => void;
}) {
  const hw = getPosHardware();
  const [printerStatus, setPrinterStatus] = useState<ConnectStatus>("idle");
  const [hidStatus, setHidStatus] = useState<ConnectStatus>("idle");
  const [serialStatus, setSerialStatus] = useState<ConnectStatus>("idle");

  const connectPrinter = async () => {
    setPrinterStatus("connecting");
    const ok = await hw.printer.requestUsbPrinter();
    setPrinterStatus(ok ? "connected" : "error");
  };

  const connectHid = async () => {
    setHidStatus("connecting");
    const ok = await hw.scanner.requestHidDevice();
    setHidStatus(ok ? "connected" : "error");
  };

  const connectSerial = async () => {
    setSerialStatus("connecting");
    const ok = await hw.scanner.requestSerialDevice();
    setSerialStatus(ok ? "connected" : "error");
  };

  const statusColor: Record<ConnectStatus, string> = {
    idle: "text-muted-foreground",
    connecting: "text-amber-500",
    connected: "text-green-500",
    error: "text-destructive",
  };
  const statusLabel: Record<ConnectStatus, string> = {
    idle: "Not connected",
    connecting: "Connecting…",
    connected: "Connected",
    error: "Connection failed",
  };

  type DeviceRow = {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    enabled: boolean;
    status: ConnectStatus;
    onConnect: () => void;
    note: string;
  };

  const devices: DeviceRow[] = [
    {
      key: "printer",
      label: "USB Receipt Printer",
      icon: Printer,
      enabled: hwCaps.usbPrinter,
      status: printerStatus,
      onConnect: connectPrinter,
      note: "Also drives the cash drawer",
    },
    {
      key: "hid",
      label: "WebHID Barcode Scanner",
      icon: ScanBarcode,
      enabled: hwCaps.hidScanner,
      status: hidStatus,
      onConnect: connectHid,
      note: "Native HID mode (Honeywell, Zebra, etc.)",
    },
    {
      key: "serial",
      label: "Serial Barcode Scanner",
      icon: ScanBarcode,
      enabled: hwCaps.serialScanner,
      status: serialStatus,
      onConnect: connectSerial,
      note: "RS-232 / USB-Serial adaptor",
    },
  ];

  return (
    <div
      className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-start justify-end"
      data-testid="hardware-panel"
    >
      <div className="w-80 h-full bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Plug className="h-4 w-4 text-primary" />
            Hardware Setup
          </div>
          <button
            onPointerDown={onClose}
            className="p-1.5 rounded hover:bg-muted transition-colors touch-manipulation"
            data-testid="close-hardware-panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Keyboard-wedge scanner — always available on any licence */}
          <div className="p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <ScanBarcode className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Keyboard-wedge Scanner</div>
                <div className="text-xs text-muted-foreground">USB HID-keyboard mode</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                Active
              </div>
            </div>
          </div>

          {/* USB / HID / Serial devices — desktop/hybrid licence only */}
          {devices.map((d) => (
            <div
              key={d.key}
              className={`p-3 rounded-xl border ${d.enabled ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-50"}`}
            >
              <div className="flex items-center gap-3">
                <d.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className={`text-xs ${statusColor[d.status]}`}>{statusLabel[d.status]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.note}</div>
                </div>
                {d.enabled && d.status !== "connected" && (
                  <button
                    onPointerDown={d.onConnect}
                    disabled={d.status === "connecting"}
                    className="shrink-0 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all touch-manipulation disabled:opacity-50"
                    data-testid={`connect-${d.key}`}
                  >
                    {d.status === "connecting" ? "…" : "Connect"}
                  </button>
                )}
                {d.enabled && d.status === "connected" && (
                  <PlugZap className="shrink-0 h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
          ))}

          {/* Licence-type capability notice */}
          {!hwCaps.usbPrinter && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Web licence — basic mode.</span>{" "}
                  USB hardware (receipt printer, cash drawer, native HID/Serial scanner)
                  requires a <strong>Hybrid</strong> licence. Keyboard-wedge scanners and
                  browser print (Ctrl+P) work on all licence types. A{" "}
                  <strong>Desktop</strong> licence is for the native CtrlTradePos® app only
                  and cannot be used with this web till.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Usb className="h-3.5 w-3.5" />
            Connect hardware before opening a session for best results.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function StatusBar({
  mode,
  isOnline,
  offlineQueueSize,
  onSyncOffline,
  isDark,
  onToggleTheme,
  isKiosk,
  onToggleKiosk,
  pwaInstallable,
  onInstallPwa,
  onOpenHardware,
  onBack,
}: {
  mode: TerminalMode;
  isOnline: boolean;
  offlineQueueSize: number;
  onSyncOffline: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isKiosk: boolean;
  onToggleKiosk: () => void;
  pwaInstallable: boolean;
  onInstallPwa: () => void;
  onOpenHardware: () => void;
  onBack: () => void;
}) {
  const modeLabel: Record<TerminalMode, string> = {
    trade_counter: "Trade Counter",
    showroom: "Showroom",
    warehouse: "Warehouse",
  };
  const ModeIcon = mode === "warehouse" ? Warehouse : mode === "showroom" ? Store : Monitor;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 text-xs shrink-0">
      <button
        onPointerDown={onBack}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors touch-manipulation p-1 rounded"
        data-testid="back-to-pos"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">POS</span>
      </button>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1 text-muted-foreground font-medium">
        <ModeIcon className="h-3.5 w-3.5" />
        <span>{modeLabel[mode]}</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {offlineQueueSize > 0 && (
          <button
            onPointerDown={onSyncOffline}
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition-colors touch-manipulation"
            data-testid="sync-offline"
          >
            <WifiOff className="h-3 w-3" />
            <span>{offlineQueueSize} queued</span>
          </button>
        )}

        <div className={`flex items-center gap-1 ${isOnline ? "text-green-500" : "text-amber-500"}`}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        </div>

        {pwaInstallable && !isPwaInstalled() && (
          <button
            onPointerDown={onInstallPwa}
            className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors touch-manipulation"
            data-testid="install-pwa"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Install</span>
          </button>
        )}

        <button
          onPointerDown={onOpenHardware}
          className="p-1.5 rounded hover:bg-muted transition-colors touch-manipulation text-muted-foreground hover:text-foreground"
          data-testid="open-hardware-panel"
          aria-label="Hardware setup"
          title="Hardware setup"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <button
          onPointerDown={onToggleTheme}
          className="p-1.5 rounded hover:bg-muted transition-colors touch-manipulation text-muted-foreground hover:text-foreground"
          data-testid="toggle-theme"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          onPointerDown={onToggleKiosk}
          className="p-1.5 rounded hover:bg-muted transition-colors touch-manipulation text-muted-foreground hover:text-foreground"
          data-testid="toggle-kiosk"
          aria-label="Toggle fullscreen"
        >
          {isKiosk ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session gate
// ---------------------------------------------------------------------------

function SessionGate({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useGetCurrentTillSession();
  const openSession = useOpenTillSession();
  const [floatStr, setFloatStr] = useState("100.00");
  const [opening, setOpening] = useState(false);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    const handleOpen = () => {
      setOpening(true);
      openSession.mutate(
        { data: { openingFloatPence: Math.round(parseFloat(floatStr || "0") * 100) } },
        { onSettled: () => setOpening(false) },
      );
    };

    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="session-gate">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div>
            <ShoppingCart className="h-12 w-12 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold">OPEN TILL</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your opening float to begin selling
            </p>
          </div>
          <div className="text-left">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Opening float (£)
            </label>
            <div className="text-3xl font-bold font-mono text-center py-3 border border-border rounded-xl bg-card">
              £{floatStr}
            </div>
            <div className="mt-3">
              <Numpad
                value={floatStr}
                onChange={setFloatStr}
                onClear={() => setFloatStr("")}
                onEnter={handleOpen}
              />
            </div>
          </div>
          <button
            onPointerDown={handleOpen}
            disabled={opening}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-all touch-manipulation disabled:opacity-50"
            data-testid="open-session"
          >
            {opening ? "OPENING…" : "OPEN TILL"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Licence gate
// ---------------------------------------------------------------------------

function LicenceGate({
  children,
  onValidated,
}: {
  children: React.ReactNode;
  onValidated?: (type: LicenceType) => void;
}) {
  const [licenceKey, setLicenceKey] = useState(
    () => localStorage.getItem("ctrltradepos-licence-key") ?? "",
  );
  const [inputKey, setInputKey] = useState("");
  const validate = useValidatePosLicence();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [licenceType, setLicenceType] = useState<LicenceType>(
    () => (localStorage.getItem("ctrltradepos-licence-type") as LicenceType | null) ?? "web",
  );

  const applyValidResult = (res: { valid?: boolean; mode?: string; licence?: { type?: string } | null }) => {
    // The API returns the type nested inside res.licence.type (ValidationOutcome shape).
    const type = (res.licence?.type as LicenceType | undefined) ?? "web";
    setLicenceType(type);
    localStorage.setItem("ctrltradepos-licence-type", type);
    setValidated(true);
    onValidated?.(type);
  };

  useEffect(() => {
    if (!licenceKey) return;
    setValidating(true);
    validate.mutate(
      { data: { licenceKey, surface: "web" } },
      {
        onSuccess: (res) => {
          if (res.valid || res.mode === "read_only") {
            applyValidResult(res as Parameters<typeof applyValidResult>[0]);
          } else {
            setError(res.message ?? "Licence not valid");
            localStorage.removeItem("ctrltradepos-licence-key");
            localStorage.removeItem("ctrltradepos-licence-type");
            setLicenceKey("");
          }
          setValidating(false);
        },
        onError: () => {
          // Allow through offline — optimistic; keep previously stored type
          setValidated(true);
          setValidating(false);
          // Notify parent with whatever type is cached so hwCaps update even offline
          onValidated?.(licenceType);
        },
      },
    );
  }, []);

  if (validating) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!licenceKey || !validated) {
    const handleActivate = () => {
      if (!inputKey.trim()) return;
      setValidating(true);
      setError(null);
      const key = inputKey.trim().toUpperCase();
      validate.mutate(
        { data: { licenceKey: key, surface: "web" } },
        {
          onSuccess: (res) => {
            if (res.valid || res.mode === "read_only") {
              localStorage.setItem("ctrltradepos-licence-key", key);
              setLicenceKey(key);
              applyValidResult(res as Parameters<typeof applyValidResult>[0]);
            } else {
              setError(res.message ?? "Licence not valid");
            }
            setValidating(false);
          },
          onError: () => {
            setError("Could not reach licence server. Check your connection.");
            setValidating(false);
          },
        },
      );
    };

    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="licence-gate">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <ScanBarcode className="h-12 w-12 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold">ACTIVATE TILL</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your CtrlTradePos® licence key
            </p>
          </div>
          <div>
            <input
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value.toUpperCase())}
              placeholder="CTP-XXXX-XXXX-XXXX"
              className="w-full h-12 rounded-xl border border-border bg-card px-4 font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="licence-key-input"
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
          <button
            onPointerDown={handleActivate}
            disabled={validating || !inputKey.trim()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-all touch-manipulation disabled:opacity-50"
            data-testid="activate-licence"
          >
            {validating ? "ACTIVATING…" : "ACTIVATE"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <LicenceCtx.Provider value={licenceType}>{children}</LicenceCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Web POS activation gate — obtains a POS bearer token via /v1/pos/login.
//
// The /v1/pos/* write endpoints (open session, create sale, etc.) require
// requirePosAuth middleware which validates a signed POS bearer token bound to
// a specific user, tenant, licence, and terminal. Regular web session cookies
// are NOT accepted for these endpoints. This gate acquires and stores that
// token, then registers it via setAuthTokenGetter so every subsequent API
// call from the till includes Authorization: Bearer <pos-token>.
// ---------------------------------------------------------------------------

const WEB_POS_TOKEN_KEY = "ctrltradepos-web-pos-token";
const WEB_POS_TERMINAL_KEY = "ctrltradepos-web-terminal-code";

function WebPosActivationGate({
  children,
  onActivated,
}: {
  children: React.ReactNode;
  onActivated?: (type: LicenceType) => void;
}) {
  const licenceKey = localStorage.getItem("ctrltradepos-licence-key") ?? "";

  const [activated, setActivated] = useState(() => {
    return !!localStorage.getItem(WEB_POS_TOKEN_KEY);
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terminalCode, setTerminalCode] = useState(
    () => localStorage.getItem(WEB_POS_TERMINAL_KEY) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // On mount: if a stored token exists, register it immediately so API calls work.
  useEffect(() => {
    const token = localStorage.getItem(WEB_POS_TOKEN_KEY);
    if (token) {
      setAuthTokenGetter(() => token);
    }
    // Cleanup: unregister POS auth when navigating away from the till.
    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  const handleActivate = async () => {
    if (!email.trim() || !password.trim() || !terminalCode.trim()) return;
    setActivating(true);
    setError(null);
    try {
      const session = await posLogin({
        email: email.trim(),
        password: password.trim(),
        licenceKey: licenceKey || null,
        terminalCode: terminalCode.trim().toUpperCase(),
        surface: "web",
      });
      const token = session.token;
      localStorage.setItem(WEB_POS_TOKEN_KEY, token);
      localStorage.setItem(WEB_POS_TERMINAL_KEY, terminalCode.trim().toUpperCase());
      setAuthTokenGetter(() => token);
      const licType = ((session as { licence?: { type?: string } }).licence?.type as LicenceType | undefined) ?? "web";
      onActivated?.(licType);
      setActivated(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Activation failed — check your credentials and terminal code";
      setError(msg);
    } finally {
      setActivating(false);
    }
  };

  if (!activated) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="pos-activation-gate">
        <div className="max-w-sm w-full space-y-5">
          <div className="text-center">
            <CreditCard className="h-12 w-12 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold">SIGN IN TO TILL</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your staff credentials and terminal code to activate this till.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="username"
              className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="pos-email-input"
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="pos-password-input"
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            />
            <input
              type="text"
              value={terminalCode}
              onChange={(e) => setTerminalCode(e.target.value.toUpperCase())}
              placeholder="Terminal code (e.g. TILL-001)"
              autoComplete="off"
              className="w-full h-11 rounded-xl border border-border bg-card px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="pos-terminal-input"
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
          <button
            onPointerDown={handleActivate}
            disabled={activating || !email.trim() || !password.trim() || !terminalCode.trim()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-all touch-manipulation disabled:opacity-50"
            data-testid="pos-activate-button"
          >
            {activating ? "ACTIVATING…" : "ACTIVATE TILL"}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Activation is stored for 14 days. Clear browser storage to sign out.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Main PosTill component
// ---------------------------------------------------------------------------

export function PosTill() {
  const [, navigate] = useLocation();

  // Hardware capabilities — reactive state updated by LicenceGate via onValidated callback.
  // Seeded from localStorage so returning users get the right capabilities immediately,
  // then updated in-session as soon as the licence is re-validated.
  const [hwLicenceType, setHwLicenceType] = useState<LicenceType>(
    () => (localStorage.getItem("ctrltradepos-licence-type") as LicenceType | null) ?? "web",
  );
  const hwCaps = getHwCapabilities(hwLicenceType);

  // UI state
  const [view, setView] = useState<View>("till");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [isKiosk, setIsKiosk] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueSize, setOfflineQueueSize] = useState(() => getOfflineQueue().length);
  const [pwaInstallable, setPwaInstallable] = useState(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [showHwPanel, setShowHwPanel] = useState(false);
  const [terminalMode, setTerminalMode] = useState<TerminalMode>(() => {
    return (localStorage.getItem("ctrltradepos-terminal-mode") as TerminalMode) ?? "trade_counter";
  });

  const searchRef = useRef<HTMLInputElement>(null);
  const createSale = useCreatePosSale();

  // Data
  const { data: rawProducts } = useListProducts();
  const { data: rawTradeAccounts } = useListPosTradeAccounts();

  const products: ProductRow[] = (rawProducts ?? [])
    .filter((p) => !p.archived)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      pricePence: p.pricePence,
      vatRatePct: p.vatRatePct ?? 20,
      categoryName: p.categoryName ?? null,
      barcode: p.barcode ?? null,
    }));

  const tradeAccounts: TradeAccountRow[] = (rawTradeAccounts ?? []).map((ta) => ({
    id: ta.id,
    name: ta.name,
    creditLimitPence: ta.creditLimitPence,
  }));

  // Hardware
  const hw = getPosHardware();

  useEffect(() => {
    setupPwaInstallPrompt();
    hw.start();

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => reg.update())
        .catch(() => null);
    }

    const onOnline = () => {
      setIsOnline(true);
      syncOffline();
    };
    const onOffline = () => setIsOnline(false);
    const onBeforeInstall = () => setPwaInstallable(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (hwCaps.customerDisplay) {
      hw.customerDisplay.show({ top: "WELCOME", bottom: "SCAN ITEMS TO BEGIN" });
    }

    return () => {
      hw.stop();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  // Barcode listener
  useEffect(() => {
    const remove = hw.scanner.addListener(({ barcode }) => {
      const product = products.find(
        (p) => p.barcode === barcode || p.sku === barcode,
      );
      if (product) addToCart(product);
    });
    return remove;
  }, [products]);

  // Customer display — only when licence supports it
  useEffect(() => {
    if (!hwCaps.customerDisplay) return;
    if (cart.length > 0) {
      hw.customerDisplay.show({
        top: `${cart.reduce((s, l) => s + l.qty, 0)} item(s)`,
        bottom: `Total: ${money(cartTotal(cart))}`,
      });
    } else {
      hw.customerDisplay.show({ top: "WELCOME", bottom: "SCAN ITEMS TO BEGIN" });
    }
  }, [cart, hwCaps.customerDisplay]);

  // Full-screen change
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setIsKiosk(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Cart actions
  // ---------------------------------------------------------------------------

  const addToCart = useCallback((p: ProductRow) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          unitPricePence: p.pricePence,
          qty: 1,
          vatRatePct: p.vatRatePct,
        },
      ];
    });
  }, []);

  const changeQty = (idx: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((l, i) => (i === idx ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const removeLine = (idx: number) =>
    setCart((prev) => prev.filter((_, i) => i !== idx));

  // ---------------------------------------------------------------------------
  // Kiosk / fullscreen
  // ---------------------------------------------------------------------------

  const toggleKiosk = () => {
    if (!isKiosk) {
      document.documentElement.requestFullscreen?.().catch(() => null);
      setIsKiosk(true);
    } else {
      document.exitFullscreen?.().catch(() => null);
      setIsKiosk(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  };

  // ---------------------------------------------------------------------------
  // PWA
  // ---------------------------------------------------------------------------

  const handleInstallPwa = async () => {
    const ok = await promptPwaInstall();
    if (ok) setPwaInstallable(false);
  };

  // ---------------------------------------------------------------------------
  // Offline sync
  // ---------------------------------------------------------------------------

  const syncOffline = async () => {
    if (!navigator.onLine) return;
    const licenceKey = localStorage.getItem("ctrltradepos-licence-key") ?? "";
    await flushOfflineQueue(
      () => ({ "X-Licence-Key": licenceKey }),
      () => setOfflineQueueSize(getOfflineQueue().length),
    );
    setOfflineQueueSize(getOfflineQueue().length);
  };

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  const handleCheckout = () => setView("payment");

  const handlePaymentComplete = (p: PaymentState) => {
    const id = `RCP-${Date.now()}`;
    setPayment(p);
    setReceiptId(id);

    const subtotal = cartSubtotal(cart);
    const tax = cartTax(cart);
    const total = cartTotal(cart);

    createSale.mutate({
      data: {
        lines: cart.map((l) => ({
          description: `${l.name} (${l.sku})`,
          quantity: l.qty,
          unitPrice: l.unitPricePence / 100,
        })),
        subtotal: subtotal / 100,
        taxAmount: tax / 100,
        total: total / 100,
        currency: "gbp",
        tender: p.tenderType === "trade_account" ? "account" : p.tenderType,
      },
    });

    setView("receipt");
  };

  const handleNewSale = () => {
    setCart([]);
    setPayment(null);
    setReceiptId("");
    setView("till");
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ---------------------------------------------------------------------------
  // Warehouse
  // ---------------------------------------------------------------------------

  const handleWarehouseAdd = (p: ProductRow, qty: number, type: "in" | "out" | "transfer") => {
    setCart((prev) => {
      const line: CartLine = {
        productId: p.id,
        sku: p.sku,
        name: `[${type.toUpperCase()}] ${p.name}`,
        unitPricePence: type === "in" ? 0 : p.pricePence,
        qty,
        vatRatePct: p.vatRatePct,
      };
      const existing = prev.findIndex((l) => l.productId === p.id);
      if (existing >= 0) return prev.map((l, i) => (i === existing ? line : l));
      return [...prev, line];
    });
  };

  // ---------------------------------------------------------------------------
  // Mode tabs
  // ---------------------------------------------------------------------------

  const setMode = (m: TerminalMode) => {
    setTerminalMode(m);
    localStorage.setItem("ctrltradepos-terminal-mode", m);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`flex flex-col bg-background text-foreground ${isKiosk ? "fixed inset-0 z-[9999]" : "h-screen overflow-hidden"}`}
      data-testid="pos-till"
    >
      <LicenceGate onValidated={setHwLicenceType}>
        <WebPosActivationGate onActivated={setHwLicenceType}>
        <SessionGate>
          {/* relative wrapper so HardwarePanel can be position:absolute over the till */}
          <div className="flex flex-col flex-1 overflow-hidden relative">
          <StatusBar
            mode={terminalMode}
            isOnline={isOnline}
            offlineQueueSize={offlineQueueSize}
            onSyncOffline={syncOffline}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            isKiosk={isKiosk}
            onToggleKiosk={toggleKiosk}
            pwaInstallable={pwaInstallable}
            onInstallPwa={handleInstallPwa}
            onOpenHardware={() => setShowHwPanel(true)}
            onBack={() => navigate("/app/pos")}
          />

          {showHwPanel && (
            <HardwarePanel hwCaps={hwCaps} onClose={() => setShowHwPanel(false)} />
          )}

          {view === "payment" && (
            <PaymentScreen
              totalPence={cartTotal(cart)}
              tradeAccounts={tradeAccounts}
              onComplete={handlePaymentComplete}
              onBack={() => setView("till")}
            />
          )}

          {view === "receipt" && payment && (
            <ReceiptView
              lines={cart}
              payment={payment}
              receiptId={receiptId}
              hwCaps={hwCaps}
              onNewSale={handleNewSale}
            />
          )}

          {view === "till" && (
            <div className="flex flex-1 overflow-hidden">
              {/* Main area */}
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search */}
                <div className="px-3 py-2 border-b border-border bg-background/95 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={
                        terminalMode === "warehouse"
                          ? "Search or scan items…"
                          : terminalMode === "showroom"
                          ? "Search products or catalogue…"
                          : "Search or scan barcode…"
                      }
                      className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                      data-testid="product-search"
                      data-barcode-field
                    />
                  </div>
                </div>

                {/* Mode-specific product area */}
                <div className="flex-1 overflow-y-auto p-3">
                  {terminalMode === "warehouse" ? (
                    <WarehousePanel
                      products={products}
                      search={search}
                      onAddLine={handleWarehouseAdd}
                    />
                  ) : (
                    <ProductGrid
                      products={products}
                      search={search}
                      onSelect={addToCart}
                      mode={terminalMode}
                    />
                  )}
                </div>

                {/* Mode tabs */}
                <div className="px-3 py-2 border-t border-border bg-background/95 shrink-0 flex gap-2">
                  {([
                    { m: "trade_counter" as TerminalMode, Icon: Monitor, label: "Trade" },
                    { m: "showroom" as TerminalMode, Icon: Store, label: "Showroom" },
                    { m: "warehouse" as TerminalMode, Icon: Warehouse, label: "Warehouse" },
                  ]).map(({ m, Icon, label }) => (
                    <button
                      key={m}
                      onPointerDown={() => setMode(m)}
                      className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all touch-manipulation ${
                        terminalMode === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      data-testid={`mode-${m}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart sidebar */}
              <div className="w-72 shrink-0 flex flex-col overflow-hidden">
                <CartPanel
                  lines={cart}
                  onQtyChange={changeQty}
                  onRemove={removeLine}
                  onCheckout={handleCheckout}
                  mode={terminalMode}
                  disabled={false}
                />
              </div>
            </div>
          )}
          </div>{/* end relative wrapper */}
        </SessionGate>
        </WebPosActivationGate>
      </LicenceGate>
    </div>
  );
}
