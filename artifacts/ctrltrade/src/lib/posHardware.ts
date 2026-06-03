/**
 * CtrlTradePos® — Hardware Abstraction Layer (Web Standard Peripherals)
 *
 * Provides a unified interface for:
 *  - Barcode scanner (keyboard-wedge + WebHID / WebSerial)
 *  - Receipt printer (window.print + WebUSB ESC/POS)
 *  - Cash-drawer kick (via printer ESC/POS DLE EOT / direct WebUSB)
 *  - Customer display (secondary browser window)
 *
 * Card terminals are intentionally stubbed behind the same interface so they
 * can be wired to real vendor SDKs (Stripe Terminal, PAX, Dojo …) later
 * without changing call sites.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BarcodeEvent {
  barcode: string;
  source: "wedge" | "webhid" | "webserial";
}

export type BarcodeListener = (evt: BarcodeEvent) => void;

export interface PrintReceiptOptions {
  lines: string[];
  title?: string;
  footer?: string;
}

export interface CustomerDisplayLine {
  top: string;
  bottom?: string;
}

export type HardwareStatus = "available" | "unavailable" | "permission_denied" | "not_supported";

export interface PeripheralInfo {
  barcodeScanner: HardwareStatus;
  receiptPrinter: HardwareStatus;
  cashDrawer: HardwareStatus;
  customerDisplay: HardwareStatus;
}

// ---------------------------------------------------------------------------
// ESC/POS helpers (minimal subset for receipts and cash-drawer)
// ---------------------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;

function escposInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]); // ESC @ — initialise
}

function escposText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function escposCut(): Uint8Array {
  // GS V 0 — full cut
  return new Uint8Array([GS, 0x56, 0x00]);
}

function escposCashDrawer(): Uint8Array {
  // ESC p 0 50 50 — open cash drawer pin 2 (standard)
  return new Uint8Array([ESC, 0x70, 0x00, 50, 50]);
}

function concatBuffers(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function buildReceiptBuffer(opts: PrintReceiptOptions): Uint8Array {
  const NL = new Uint8Array([0x0a]);
  const parts: Uint8Array[] = [escposInit()];
  if (opts.title) {
    parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold on
    parts.push(escposText(`${opts.title}\n`));
    parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold off
  }
  for (const line of opts.lines) {
    parts.push(escposText(line));
    parts.push(NL);
  }
  if (opts.footer) {
    parts.push(NL);
    parts.push(escposText(opts.footer));
    parts.push(NL);
  }
  parts.push(NL, NL);
  parts.push(escposCut());
  return concatBuffers(...parts);
}

// ---------------------------------------------------------------------------
// Barcode Scanner
// ---------------------------------------------------------------------------

class BarcodeScannerService {
  private listeners: Set<BarcodeListener> = new Set();
  private wedgeBuffer = "";
  private wedgeTimer: ReturnType<typeof setTimeout> | null = null;
  private hidDevice: HIDDevice | null = null;
  /** Accumulated barcode characters across multiple WebHID reports. */
  private hidBuffer = "";
  private serialPort: SerialPort | null = null;
  private wedgeActive = false;

  /** Start listening for barcodes. Call once on mount. */
  start(): void {
    this.startWedgeListener();
  }

  stop(): void {
    this.stopWedgeListener();
    this.closeHid();
    this.closeSerial();
  }

  addListener(fn: BarcodeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(barcode: string, source: BarcodeEvent["source"]) {
    if (!barcode.trim()) return;
    this.listeners.forEach((fn) => fn({ barcode: barcode.trim(), source }));
  }

  // ---- Keyboard-wedge (USB HID in HID-KB mode) -------------------------
  // Barcode scanners in keyboard-wedge mode emit keystrokes ending with Enter.
  // We detect fast bursts of characters (< 50 ms per char) followed by Enter.

  private startWedgeListener() {
    if (this.wedgeActive) return;
    this.wedgeActive = true;
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  private stopWedgeListener() {
    this.wedgeActive = false;
    document.removeEventListener("keydown", this.onKeyDown, true);
    if (this.wedgeTimer) clearTimeout(this.wedgeTimer);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Ignore if focus is in a text input that should receive normal typing
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    if (e.key === "Enter") {
      if (this.wedgeBuffer.length >= 4) {
        // Only treat as a barcode if not inside a plain text input
        // (to avoid eating form submits). POS inputs are marked data-barcode-field.
        const inBarcodeField = target.closest("[data-barcode-field]") !== null;
        if (!isInput || inBarcodeField) {
          e.preventDefault();
          const barcode = this.wedgeBuffer;
          this.wedgeBuffer = "";
          this.emit(barcode, "wedge");
          return;
        }
      }
      this.wedgeBuffer = "";
      return;
    }

    if (e.key && e.key.length === 1) {
      if (this.wedgeTimer) clearTimeout(this.wedgeTimer);
      this.wedgeBuffer += e.key;
      // Reset buffer if no character arrives within 80 ms (human typing pace)
      this.wedgeTimer = setTimeout(() => {
        this.wedgeBuffer = "";
      }, 80);
    }
  };

  // ---- WebHID (native HID access, e.g. Honeywell / Zebra in HID mode) ---
  async requestHidDevice(): Promise<boolean> {
    if (!("hid" in navigator)) return false;
    try {
      const devices = await (navigator as unknown as { hid: HID }).hid.requestDevice({
        filters: [], // let the user pick any HID device
      });
      if (!devices.length) return false;
      this.hidDevice = devices[0];
      await this.hidDevice.open();
      this.hidDevice.addEventListener("inputreport", this.onHidReport);
      return true;
    } catch {
      return false;
    }
  }

  private onHidReport = (e: HIDInputReportEvent) => {
    // Basic HID keyboard report decoding (boot protocol, 8 bytes).
    // Each report may contain 0–6 keycodes. Barcode scanners in native HID mode
    // send characters across *multiple* reports (one per key event), so we must
    // accumulate into hidBuffer and only emit on Enter.
    const data = new Uint8Array(e.data.buffer);
    for (let i = 2; i < 8; i++) {
      const kc = data[i];
      if (kc === 0) continue;
      if (kc === 0x28) {
        // Enter — emit the accumulated buffer if it looks like a barcode
        const barcode = this.hidBuffer;
        this.hidBuffer = "";
        if (barcode.length >= 4) this.emit(barcode, "webhid");
        return;
      }
      if (kc >= 0x04 && kc <= 0x1d) {
        // a–z  (HID usage 0x04 = 'a')
        this.hidBuffer += String.fromCharCode(kc + 61);
      } else if (kc >= 0x1e && kc <= 0x27) {
        // 1–9, 0
        this.hidBuffer += String.fromCharCode(kc === 0x27 ? 48 : kc + 19);
      }
      // other keycodes (shift, symbols, etc.) are ignored for barcode purposes
    }
  };

  async closeHid() {
    if (this.hidDevice) {
      this.hidDevice.removeEventListener("inputreport", this.onHidReport);
      await this.hidDevice.close().catch(() => null);
      this.hidDevice = null;
    }
  }

  // ---- WebSerial (serial scanners, some thermal printers) ----------------
  async requestSerialDevice(): Promise<boolean> {
    if (!("serial" in navigator)) return false;
    try {
      const port = await (navigator as unknown as { serial: Serial }).serial.requestPort();
      await port.open({ baudRate: 9600 });
      this.serialPort = port;
      this.readSerial(port);
      return true;
    } catch {
      return false;
    }
  }

  private async readSerial(port: SerialPort) {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) this.emit(line.trim(), "webserial");
        }
      }
    } catch {
      // connection lost
    } finally {
      reader.releaseLock();
    }
  }

  async closeSerial() {
    if (this.serialPort) {
      await this.serialPort.close().catch(() => null);
      this.serialPort = null;
    }
  }

  /** Returns current HW status of the barcode scanner. */
  status(): HardwareStatus {
    if (this.hidDevice || this.serialPort) return "available";
    if (this.wedgeActive) return "available"; // wedge always available
    return "unavailable";
  }
}

// ---------------------------------------------------------------------------
// Receipt Printer
// ---------------------------------------------------------------------------

class ReceiptPrinterService {
  private usbDevice: USBDevice | null = null;
  private usbInterface: number | null = null;
  private usbEndpoint: number | null = null;

  /** Print using the browser's native print dialog (network / system printers). */
  printWithDialog(opts: PrintReceiptOptions): void {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const html = `
<!DOCTYPE html><html><head>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 8px; }
  h2 { font-size: 14px; text-align: center; margin: 0 0 8px; }
  pre { white-space: pre-wrap; word-break: break-all; margin: 0; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
</style>
</head><body>
${opts.title ? `<h2>${opts.title}</h2><hr>` : ""}
<pre>${opts.lines.join("\n")}</pre>
${opts.footer ? `<hr><pre style="text-align:center;">${opts.footer}</pre>` : ""}
</body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  /** Request a WebUSB thermal printer and send ESC/POS data. */
  async requestUsbPrinter(): Promise<boolean> {
    if (!("usb" in navigator)) return false;
    try {
      const device = await (navigator as unknown as { usb: USB }).usb.requestDevice({
        filters: [
          // Common thermal printer vendor IDs
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x154f }, // SNBC
          { vendorId: 0x0dd4 }, // Custom/Citizen
          { vendorId: 0x1fc9 }, // NXP / generic OPOS
        ],
      });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);

      // Find the first bulk-out endpoint
      for (const iface of device.configuration?.interfaces ?? []) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.type === "bulk" && ep.direction === "out") {
              await device.claimInterface(iface.interfaceNumber);
              this.usbDevice = device;
              this.usbInterface = iface.interfaceNumber;
              this.usbEndpoint = ep.endpointNumber;
              return true;
            }

          }
        }
      }
      await device.close();
      return false;
    } catch {
      return false;
    }
  }

  async printUsb(opts: PrintReceiptOptions): Promise<boolean> {
    if (!this.usbDevice || this.usbEndpoint === null) return false;
    try {
      const data = buildReceiptBuffer(opts);
      await this.usbDevice.transferOut(this.usbEndpoint, data.buffer as ArrayBuffer);
      return true;
    } catch {
      return false;
    }
  }

  /** Print receipt — tries USB first, then falls back to dialog. */
  async print(opts: PrintReceiptOptions): Promise<void> {
    if (this.usbDevice) {
      const ok = await this.printUsb(opts);
      if (ok) return;
    }
    this.printWithDialog(opts);
  }

  async releaseUsb() {
    if (this.usbDevice) {
      if (this.usbInterface !== null) {
        await this.usbDevice.releaseInterface(this.usbInterface).catch(() => null);
      }
      await this.usbDevice.close().catch(() => null);
      this.usbDevice = null;
      this.usbInterface = null;
      this.usbEndpoint = null;
    }
  }

  status(): HardwareStatus {
    if (!("usb" in navigator)) return "not_supported";
    if (this.usbDevice) return "available";
    return "unavailable";
  }
}

// ---------------------------------------------------------------------------
// Cash Drawer
// ---------------------------------------------------------------------------

class CashDrawerService {
  constructor(private printer: ReceiptPrinterService) {}

  /** Kick the cash drawer via the USB printer's ESC/POS channel. */
  async kick(): Promise<boolean> {
    const device = (this.printer as unknown as { usbDevice: USBDevice | null }).usbDevice;
    const endpoint = (this.printer as unknown as { usbEndpoint: number | null }).usbEndpoint;
    if (!device || endpoint === null) return false;
    try {
      const cmd = concatBuffers(escposInit(), escposCashDrawer());
      await device.transferOut(endpoint, cmd.buffer as ArrayBuffer);
      return true;
    } catch {
      return false;
    }
  }

  status(): HardwareStatus {
    const device = (this.printer as unknown as { usbDevice: USBDevice | null }).usbDevice;
    if (!("usb" in navigator)) return "not_supported";
    return device ? "available" : "unavailable";
  }
}

// ---------------------------------------------------------------------------
// Customer Display
// ---------------------------------------------------------------------------

class CustomerDisplayService {
  private win: Window | null = null;

  open(): boolean {
    if (this.win && !this.win.closed) return true;
    this.win = window.open(
      "",
      "ctrltradepos-customer-display",
      "width=800,height=200,toolbar=no,menubar=no,scrollbars=no,resizable=yes",
    );
    if (!this.win) return false;
    this.win.document.write(`
<!DOCTYPE html><html><head>
<title>CtrlTradePos® — Customer Display</title>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #09090b; color: #fafafa; font-family: 'Courier New', monospace;
    height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px;
    padding: 20px; text-align: center;
  }
  #top { font-size: 24px; font-weight: 700; letter-spacing: 2px; }
  #bottom { font-size: 16px; opacity: 0.6; letter-spacing: 1px; }
  #logo { font-size: 11px; position: absolute; bottom: 10px; right: 14px; opacity: 0.3; }
</style>
</head><body>
<div id="top">WELCOME</div>
<div id="bottom">SCAN ITEMS TO BEGIN</div>
<div id="logo">CtrlTradePos®</div>
</body></html>`);
    this.win.document.close();
    return true;
  }

  show(line: CustomerDisplayLine): void {
    if (!this.win || this.win.closed) {
      this.open();
    }
    try {
      const doc = this.win!.document;
      const top = doc.getElementById("top");
      const bottom = doc.getElementById("bottom");
      if (top) top.textContent = line.top;
      if (bottom) bottom.textContent = line.bottom ?? "";
    } catch {
      // cross-origin or window closed
    }
  }

  close(): void {
    if (this.win && !this.win.closed) {
      this.win.close();
    }
    this.win = null;
  }

  status(): HardwareStatus {
    if (this.win && !this.win.closed) return "available";
    return "unavailable";
  }
}

// ---------------------------------------------------------------------------
// Card Terminal (stubbed — future vendor integration)
// ---------------------------------------------------------------------------

export interface CardPaymentRequest {
  amountPence: number;
  currency?: string;
  reference?: string;
}

export interface CardPaymentResult {
  success: boolean;
  authCode?: string;
  errorMessage?: string;
  stub: true;
}

class CardTerminalService {
  /** Simulate a card payment — replace with vendor SDK in production. */
  async requestPayment(req: CardPaymentRequest): Promise<CardPaymentResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          authCode: `AUTH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          stub: true,
        });
      }, 1500);
    });
  }

  status(): HardwareStatus {
    return "unavailable"; // stub until a vendor SDK is wired
  }
}

// ---------------------------------------------------------------------------
// Singleton hardware service
// ---------------------------------------------------------------------------

export class PosHardwareService {
  readonly scanner = new BarcodeScannerService();
  readonly printer = new ReceiptPrinterService();
  readonly cashDrawer = new CashDrawerService(this.printer);
  readonly customerDisplay = new CustomerDisplayService();
  readonly cardTerminal = new CardTerminalService();

  start(): void {
    this.scanner.start();
  }

  stop(): void {
    this.scanner.stop();
    this.printer.releaseUsb();
    this.customerDisplay.close();
  }

  peripheralInfo(): PeripheralInfo {
    return {
      barcodeScanner: this.scanner.status(),
      receiptPrinter: this.printer.status(),
      cashDrawer: this.cashDrawer.status(),
      customerDisplay: this.customerDisplay.status(),
    };
  }
}

// Global singleton (created once, shared across the till session)
let _hw: PosHardwareService | null = null;
export function getPosHardware(): PosHardwareService {
  if (!_hw) _hw = new PosHardwareService();
  return _hw;
}

// ---------------------------------------------------------------------------
// Offline transaction queue (localStorage-backed)
// ---------------------------------------------------------------------------

export interface OfflineTx {
  id: string;
  url: string;
  method: string;
  body: string;
  queuedAt: string;
}

const QUEUE_KEY = "ctrltradepos-offline-queue";

export function getOfflineQueue(): OfflineTx[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function enqueueOfflineTx(tx: Omit<OfflineTx, "id">): OfflineTx {
  const entry: OfflineTx = { ...tx, id: crypto.randomUUID() };
  const queue = getOfflineQueue();
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function removeOfflineTx(id: string): void {
  const queue = getOfflineQueue().filter((t) => t.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(
  getHeaders: () => Record<string, string>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  let synced = 0;
  let failed = 0;
  for (const tx of queue) {
    try {
      const res = await fetch(tx.url, {
        method: tx.method,
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: tx.body,
      });
      if (res.ok || res.status < 500) {
        removeOfflineTx(tx.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.(synced + failed, queue.length);
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// PWA installation helper
// ---------------------------------------------------------------------------

let _deferredPrompt: Event | null = null;

export function setupPwaInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
  });
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!_deferredPrompt) return false;
  const prompt = _deferredPrompt as unknown as {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  _deferredPrompt = null;
  return outcome === "accepted";
}

export function isPwaInstallable(): boolean {
  return _deferredPrompt !== null;
}

export function isPwaInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

// WebHID / WebSerial type stubs (not yet in all TypeScript lib.dom)
declare global {
  interface HID extends EventTarget {
    requestDevice(options: { filters: object[] }): Promise<HIDDevice[]>;
  }
  interface HIDDevice extends EventTarget {
    open(): Promise<void>;
    close(): Promise<void>;
    productName: string;
    addEventListener(type: "inputreport", listener: (e: HIDInputReportEvent) => void): void;
    removeEventListener(type: "inputreport", listener: (e: HIDInputReportEvent) => void): void;
  }
  interface HIDInputReportEvent extends Event {
    data: DataView;
  }
  interface Serial {
    requestPort(): Promise<SerialPort>;
  }
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
  }
  interface USB {
    requestDevice(options: { filters: object[] }): Promise<USBDevice>;
  }
  interface USBDevice {
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configuration: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
    configuration: USBConfiguration | null;
  }
  interface USBConfiguration {
    interfaces: USBInterface[];
  }
  interface USBInterface {
    interfaceNumber: number;
    alternates: USBAlternateInterface[];
  }
  interface USBAlternateInterface {
    endpoints: USBEndpoint[];
  }
  interface USBEndpoint {
    endpointNumber: number;
    type: string;
    direction: string;
  }
  interface USBOutTransferResult {
    bytesWritten: number;
    status: string;
  }
}
