import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Monitor, Smartphone, Barcode, Printer, Wifi, Package, Users,
  CreditCard, ReceiptText, ArrowRight, CheckCircle2, Building2, Warehouse,
  AppWindow, Laptop
} from "lucide-react";

const tillFeatures = [
  { icon: Monitor, title: "Touchscreen Till", desc: "Large-format touchscreen interface optimised for fast trade counter sales. Quick-action buttons, product search, and barcode lookup." },
  { icon: Barcode, title: "Barcode Scanning", desc: "Scan EAN/UPC barcodes to instantly add products to the cart. Compatible with keyboard-wedge and USB scanners." },
  { icon: Printer, title: "Receipt Printing", desc: "Thermal and network receipt printer support. Print or email receipts. Branded with your company logo and details." },
  { icon: Users, title: "Trade Accounts", desc: "Bill to customer trade accounts. Collect statements, set credit limits, and view outstanding balances in the CRM." },
  { icon: Package, title: "Stock Control", desc: "Real-time stock deduction on every sale. Low-stock alerts, stocktake tools, and supplier order integration." },
  { icon: CreditCard, title: "Split Payments", desc: "Cash, card, trade account, or split across multiple tender types. Every transaction synced to the CRM." },
  { icon: ReceiptText, title: "Till Sessions", desc: "Open with a float, close with a cash count. End-of-day reconciliation report with full transaction breakdown." },
  { icon: Wifi, title: "Offline Mode", desc: "Keep selling when internet is down. Transactions queue locally and sync automatically when reconnected." },
];

const hardware = [
  { name: "Barcode Scanners", detail: "Keyboard-wedge, USB, WebHID, WebSerial compatible" },
  { name: "Receipt Printers", detail: "Thermal, network, and USB — via browser print API and WebUSB" },
  { name: "Cash Drawers", detail: "Triggered automatically on cash transactions" },
  { name: "Customer Displays", detail: "Secondary screen showing order total and confirmation" },
  { name: "Label Printers", detail: "Product and price label printing for warehouse and stock use" },
];

const platforms = [
  {
    icon: AppWindow,
    title: "Windows",
    desc: "Full EPOS experience on Windows 10 & 11. Optimised for touchscreen tills and dedicated counter hardware.",
    cta: "Open on Windows",
    href: "/ctrltradepos/",
    external: false,
  },
  {
    icon: Laptop,
    title: "macOS",
    desc: "Run CtrlTradePos® on any Mac. Ideal for showroom and back-office till setups.",
    cta: "Open on Mac",
    href: "/ctrltradepos/",
    external: false,
  },
  {
    icon: Smartphone,
    title: "iOS",
    desc: "Sell from an iPhone or iPad. Portable till for trade counters, events, and pop-up locations.",
    cta: "App Store",
    href: "#",
    external: true,
  },
  {
    icon: Smartphone,
    title: "Android",
    desc: "Native Android app for phones and tablets. Works with Bluetooth scanners and portable printers.",
    cta: "Google Play",
    href: "#",
    external: true,
  },
];

const useCases = [
  { icon: Building2, title: "Trade Counters", desc: "Fast walk-in counter sales with barcode scanning, trade account billing, and stock deduction." },
  { icon: Warehouse, title: "Warehouses", desc: "Goods in/out, picking, packing, and stock transfers alongside till operations." },
  { icon: Monitor, title: "Showrooms", desc: "Product display, consultation, quote building, and deposit collection in one interface." },
];

export function CtrlTradePosPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CTRLTRADEPOS®
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">Built For Trade Counters, Warehouses And Showrooms</h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            A full EPOS system that connects directly to your inventory, CRM, trade accounts, and supplier orders — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-8 text-base font-semibold w-full sm:w-auto">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-base font-semibold bg-transparent w-full sm:w-auto" style={{ borderColor: "hsla(215,30%,93%,0.4)", color: "hsl(215,30%,93%)" }}>
                £59.99 / till / month
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Till Features</h2>
            <p className="text-muted-foreground text-lg">Everything a busy trade counter needs to sell fast and stay organised.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {tillFeatures.map((f, i) => (
              <div key={i} className="border border-border bg-card p-6 hover:border-primary transition-colors group">
                <f.icon className="h-7 w-7 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Available On Every Platform</h2>
            <p className="text-muted-foreground">Download CtrlTradePos® for your device and start selling today.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((p, i) => (
              <div key={i} className="border border-primary bg-primary/5 p-6 flex flex-col">
                <p.icon className="h-9 w-9 text-primary mb-4" />
                <h3 className="text-lg font-bold mb-2">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1">{p.desc}</p>
                {p.external ? (
                  <a href={p.href} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="w-full font-semibold">{p.cta}</Button>
                  </a>
                ) : (
                  <Link href={p.href}>
                    <Button size="sm" className="w-full font-semibold">{p.cta}</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Hardware Support</h2>
              <p className="text-muted-foreground mb-8 text-lg">CtrlTradePos® works with industry-standard EPOS hardware via open web standards — no proprietary lock-in.</p>
              <div className="space-y-4">
                {hardware.map((h, i) => (
                  <div key={i} className="flex items-start gap-4 border border-border p-4 bg-card">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">{h.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{h.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-border bg-card p-8 shadow-lg">
              <div className="border-b border-border pb-4 mb-4 flex items-center justify-between">
                <div className="font-bold">CtrlTradePos®</div>
                <div className="text-xs bg-green-500/20 text-green-700 font-bold px-2 py-1">TILL OPEN</div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { name: "4\" Copper Pipe 15mm x 3m", qty: 2, price: "£18.00" },
                  { name: "Compression Elbow 15mm", qty: 5, price: "£12.50" },
                  { name: "PTFE Tape (10m)", qty: 1, price: "£1.20" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                    <div className="font-medium">{item.name}</div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>×{item.qty}</span>
                      <span className="font-mono font-bold text-foreground">{item.price}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center font-bold text-lg border-t border-border pt-4 mb-4">
                <span>Total</span>
                <span className="font-mono text-primary">£31.70</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className="border border-border bg-background p-2 text-xs font-bold hover:border-primary transition-colors">CASH</button>
                <button className="border border-primary bg-primary text-primary-foreground p-2 text-xs font-bold">CARD</button>
                <button className="border border-border bg-background p-2 text-xs font-bold hover:border-primary transition-colors">ACCOUNT</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built For Every Operation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCases.map((u, i) => (
              <div key={i} className="border border-border p-8 bg-background hover:border-primary transition-colors">
                <u.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-bold mb-2">{u.title}</h3>
                <p className="text-muted-foreground text-sm">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="text-4xl font-bold font-mono text-[hsl(46,98%,52%)] mb-2">£59.99</div>
          <div className="text-lg mb-4" style={{ color: "hsl(220,25%,62%)" }}>per till / per month</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Add CtrlTradePos® To Your Account</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Included in every account during your free 1 month trial.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 text-base font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
