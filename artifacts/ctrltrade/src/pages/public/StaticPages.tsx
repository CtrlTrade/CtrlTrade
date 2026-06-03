import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCreatePlatformLead } from "@workspace/api-client-react";
import { PageHead } from "@/components/PageHead";
import {
  ArrowRight, Shield, Zap, CheckCircle2, HardHat, CalendarCheck, FileText,
  Truck, ShieldCheck, Mail, MapPin, BarChart3, Users, Package, CreditCard,
  Phone, Star, Wifi, Monitor, Globe, Bot, Mic
} from "lucide-react";

// ─── HOME ────────────────────────────────────────────────────────────────────

const builtFor = [
  "Sole Traders", "Trade Businesses", "Suppliers", "Trade Counters",
  "Warehouses", "Showrooms", "Field Service Companies", "Multi-Branch Operators",
];

const coreModules = [
  {
    href: "/crm",
    icon: FileText,
    title: "CRM",
    badge: "Included",
    items: ["Leads", "Customers", "Quotes", "Jobs", "Scheduling", "Invoicing"],
    desc: "The complete back-office and field management system for trade businesses.",
  },
  {
    href: "/ctrltradepos",
    icon: Monitor,
    title: "CtrlTradePos®",
    badge: "£59.99 / till",
    items: ["Trade Counters", "Showrooms", "Warehouses", "Stock", "Trade Accounts", "Till Sales"],
    desc: "Purpose-built EPOS for trade counters, warehouses, and showrooms.",
  },
  {
    href: "/customer-portal",
    icon: Globe,
    title: "Customer Portal",
    badge: "Included",
    items: ["Accept Quotes", "Track Jobs", "Pay Invoices", "Leave Reviews"],
    desc: "A branded self-service portal for your customers — 24/7.",
  },
  {
    href: "/addons",
    icon: Bot,
    title: "CtrlAI®",
    badge: "Add-on",
    items: ["AI Quotes", "AI Dispatch", "AI Reporting", "AI Insights"],
    desc: "AI-powered automation built for trade business workflows.",
  },
  {
    href: "/addons",
    icon: Mic,
    title: "CtrlVoice®",
    badge: "Add-on",
    items: ["VoIP", "SMS", "WhatsApp", "Call Recording"],
    desc: "Integrated communications — all logged to the customer record.",
  },
];

const industryTiles = [
  { label: "Roofing", href: "/roofing-crm" },
  { label: "Electrical", href: "/electrical-crm" },
  { label: "Plumbing", href: "/plumbing-crm" },
  { label: "HVAC", href: "/hvac-crm" },
  { label: "Building", href: "/builders-crm" },
  { label: "Construction", href: "/builders-crm" },
  { label: "Facilities", href: "/facilities-management-crm" },
  { label: "Cleaning", href: "/cleaning-crm" },
  { label: "Landscaping", href: "/industries" },
  { label: "Fire & Security", href: "/industries" },
  { label: "Warehousing", href: "/warehouse-management-software" },
  { label: "Multi-Trade", href: "/industries" },
];

const compareFeatures = ["CRM", "EPOS", "Warehouse", "Customer Portal", "AI", "Marketplace", "VoIP"];
const competitors = [
  { name: "CtrlTrade®", highlight: true, values: [true, true, true, true, true, true, true] },
  { name: "Jobber", values: [true, false, false, false, false, false, false] },
  { name: "Tradify", values: [true, false, false, false, false, false, false] },
  { name: "ServiceM8", values: [true, false, false, true, false, false, false] },
  { name: "SimPRO", values: [true, false, false, true, false, false, false] },
];

const includedItems = [
  "1 Month Free Trial",
  "Unlimited Customers",
  "Unlimited Quotes",
  "Unlimited Jobs",
  "Unlimited Storage (Fair Usage)",
  "Customer Portal",
];

export function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="The Complete Operating System For Trade Businesses"
        description="CtrlTrade® is the complete operating system for trade businesses. CRM, Scheduling, Dispatch, Invoicing, Customer Portal, EPOS & Warehouse Management — all in one platform."
        canonical="/"
      />
      {/* Hero */}
      <section className="py-24 md:py-36 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-5xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            TRADE OPERATING SYSTEM
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            The Complete Operating System For Trade Businesses
          </h1>
          <p className="text-lg md:text-xl mb-12 max-w-3xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            CRM, Scheduling, Dispatch, Invoicing, Customer Portal, AI, Trade Counter EPOS and Warehouse Management — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-10 text-base font-bold w-full sm:w-auto" data-testid="button-hero-cta">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-base font-semibold bg-transparent w-full sm:w-auto" style={{ borderColor: "hsla(215,30%,93%,0.4)", color: "hsl(215,30%,93%)" }} data-testid="button-hero-secondary">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-16 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Built For</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mx-auto">
            {builtFor.map((item) => (
              <div key={item} className="flex items-center gap-2 border border-border bg-background px-4 py-2.5 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform overview */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">One Platform. Everything Connected.</h2>
          <p className="text-muted-foreground text-lg mb-12">Stop juggling five apps. CtrlTrade® connects every part of your business in one operating system.</p>
          <div className="flex flex-col items-center gap-0">
            {[
              { label: "CtrlTrade® SaaS Platform", sub: "The operating layer" },
              { label: "CtrlTrade CRM", sub: "Leads → Jobs → Invoices" },
              { label: "CtrlTradePos®", sub: "Trade counter EPOS" },
              { label: "Customer Portal", sub: "Self-service for customers" },
            ].map((item, i, arr) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`border px-8 py-4 w-72 text-center ${i === 0 ? "border-[hsl(46,98%,52%)] bg-[hsl(220,90%,8%)] text-[hsl(215,30%,93%)]" : "border-border bg-card"}`}>
                  <div className="font-bold">{item.label}</div>
                  <div className={`text-xs mt-0.5 ${i === 0 ? "text-[hsl(220,25%,62%)]" : "text-muted-foreground"}`}>{item.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core modules */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Core Modules</h2>
            <p className="text-muted-foreground text-lg">Every module your trade business needs — in one connected platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {coreModules.map((mod, i) => (
              <Link key={i} href={mod.href} className="block group">
                <div className="border border-border bg-background p-8 h-full hover:border-primary transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <mod.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1">{mod.badge}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{mod.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{mod.desc}</p>
                  <ul className="space-y-1">
                    {mod.items.map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built For Your Industry</h2>
            <p className="text-muted-foreground text-lg">CtrlTrade® adapts to the specific workflows, compliance requirements, and terminology of your trade.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-10">
            {industryTiles.map((tile) => (
              <Link key={tile.label} href={tile.href}
                className="border border-border bg-card p-4 text-center text-sm font-semibold hover:border-primary hover:text-primary transition-colors">
                {tile.label}
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link href="/industries">
              <Button variant="outline" size="lg" className="rounded-xl">
                View All Industries <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature comparison */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">CtrlTrade® vs. The Competition</h2>
            <p className="text-muted-foreground">The only platform built for both field service <em>and</em> trade counter operations.</p>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold text-muted-foreground w-40">Feature</th>
                  {competitors.map(c => (
                    <th key={c.name} className={`p-4 text-center font-bold ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareFeatures.map((feat, fi) => (
                  <tr key={feat} className={`border-b border-border/50 last:border-0 ${fi % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="p-4 font-medium">{feat}</td>
                    {competitors.map(c => (
                      <td key={c.name} className="p-4 text-center">
                        {c.values[fi]
                          ? <CheckCircle2 className={`h-5 w-5 mx-auto ${c.highlight ? "text-green-500" : "text-green-400"}`} />
                          : <span className="text-muted-foreground/40 text-lg">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Included */}
      <section className="py-20 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-bold mb-8">Every Account Includes</h2>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {includedItems.map(item => (
              <div key={item} className="flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-black mb-6">Start Your Free 1 Month Trial</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>No demo. No sales call. Sign up and be running in minutes.</p>
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

// ─── FEATURES ────────────────────────────────────────────────────────────────

const featureGroups = [
  {
    group: "CRM & Operations",
    features: [
      { icon: Users, title: "Lead Management", desc: "Capture, score, assign, and track leads from all sources. Convert to quotes and jobs with one click." },
      { icon: FileText, title: "Quote Engine", desc: "Build professional quotes with line items, labour, materials, and VAT. Digital e-signature and deposit collection." },
      { icon: HardHat, title: "Job Management", desc: "End-to-end job tracking. Assign engineers, capture compliance data, and complete sign-off from the field app." },
      { icon: CalendarCheck, title: "Scheduling & Dispatch", desc: "Drag-and-drop dispatch board with engineer availability, skill-based assignment, and route optimisation." },
      { icon: Users, title: "Customer Management", desc: "Full customer CRM with contact history, job history, quotes, invoices, trade accounts, and portal access." },
      { icon: BarChart3, title: "Reporting & Analytics", desc: "Revenue, job profitability, lead ROI, engineer performance, aged debtors, and customer lifetime value reports." },
    ],
  },
  {
    group: "Finance & Invoicing",
    features: [
      { icon: FileText, title: "Invoicing", desc: "Auto-generate invoices from completed jobs. Send by email, collect payment via Stripe or the customer portal." },
      { icon: CreditCard, title: "Online Payments", desc: "Accept card payments for deposits and invoices via the customer portal. Stripe-powered, fully branded." },
      { icon: Zap, title: "Automated Chasing", desc: "Set up automated payment reminders. Reduce overdue invoices without manual chasing." },
      { icon: FileText, title: "Xero & QuickBooks", desc: "Push invoices and payments to Xero or QuickBooks automatically. Keep your accounts in sync." },
    ],
  },
  {
    group: "Field & Compliance",
    features: [
      { icon: Truck, title: "Fleet Management", desc: "Track vehicle locations, log MOT and service dates, record mileage, and manage fuel costs." },
      { icon: ShieldCheck, title: "Compliance & RAMS", desc: "Built-in RAMS, risk assessments, method statements, and certification tracking with automated expiry alerts." },
      { icon: CalendarCheck, title: "Timesheets", desc: "Engineers log hours from the mobile app. Timesheet reports export for payroll." },
      { icon: Shield, title: "Certifications", desc: "Store engineer certificates and qualifications. Auto-alert before expiry." },
    ],
  },
  {
    group: "EPOS & Stock",
    features: [
      { icon: Monitor, title: "CtrlTradePos® Till", desc: "Touchscreen EPOS for trade counters. Barcode scanning, cash/card/account payment, receipt printing." },
      { icon: Package, title: "Stock Management", desc: "Real-time stock levels, low-stock alerts, stocktake tools, and goods in/out tracking." },
      { icon: Package, title: "Supplier Orders", desc: "Raise and manage purchase orders. Auto-reorder below minimum stock levels." },
      { icon: Users, title: "Trade Accounts", desc: "Bill customers to trade accounts. Set credit limits, view statements, and collect balances." },
    ],
  },
  {
    group: "AI & Automation",
    features: [
      { icon: Bot, title: "CtrlAI® Quotes", desc: "AI-assisted quote creation. Describe the job and get a structured quote with suggested line items." },
      { icon: Bot, title: "CtrlAI® Dispatch", desc: "AI-powered engineer assignment based on skills, location, and availability." },
      { icon: Zap, title: "Automation Rules", desc: "Trigger-based automations: auto-assign jobs, send reminders, escalate payments, notify customers." },
      { icon: Mic, title: "CtrlVoice® VoIP", desc: "Integrated phone system with call recording, SMS, and WhatsApp — all logged to the customer record." },
    ],
  },
];

export function Features() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Features — CRM, EPOS, Compliance & More For Trade Businesses"
        description="Explore every feature in CtrlTrade®: CRM, scheduling, invoicing, EPOS, fleet management, compliance, AI automation, and more — all built for trade businesses."
        canonical="/features"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            FEATURES
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">Full Arsenal</h1>
          <p className="text-lg md:text-xl max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>
            Every tool you need to run a trade business — CRM, EPOS, compliance, fleet, invoicing, AI, and more. No modular pricing traps.
          </p>
        </div>
      </section>

      {featureGroups.map((group, gi) => (
        <section key={gi} className={`py-20 border-t border-border ${gi % 2 === 0 ? "bg-background" : "bg-card"}`}>
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-2xl font-bold mb-8 text-muted-foreground uppercase tracking-wider text-sm">{group.group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {group.features.map((f, i) => (
                <div key={i} className="border border-border bg-card p-6 hover:border-primary transition-colors group">
                  <f.icon className="h-7 w-7 text-primary mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">Everything In One Platform</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Start your free 1 month trial — no credit card required.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── INTEGRATIONS ─────────────────────────────────────────────────────────────

const integrationGroups = [
  {
    category: "Accounting",
    items: [
      { name: "Xero", detail: "Invoice push, contact sync, payment reconciliation" },
      { name: "QuickBooks", detail: "Invoice sync and financial reporting" },
      { name: "Sage", detail: "Accounting integration (coming soon)" },
    ],
  },
  {
    category: "Communication",
    items: [
      { name: "Microsoft Teams", detail: "Job notifications and team alerts" },
      { name: "Outlook", detail: "Calendar sync for job scheduling" },
      { name: "WhatsApp", detail: "Customer messaging via CtrlVoice®" },
      { name: "Twilio", detail: "SMS delivery for notifications and reminders" },
    ],
  },
  {
    category: "Lead Sources",
    items: [
      { name: "MyJobQuote", detail: "Automatic lead import" },
      { name: "Checkatrade", detail: "Automatic lead import" },
      { name: "Bark", detail: "Automatic lead import" },
      { name: "Rated People", detail: "Automatic lead import" },
      { name: "TrustATrader", detail: "Automatic lead import" },
    ],
  },
  {
    category: "AI & Intelligence",
    items: [
      { name: "OpenAI", detail: "Powers CtrlAI® quote, dispatch, and reporting features" },
    ],
  },
  {
    category: "Maps & Location",
    items: [
      { name: "Google Maps", detail: "Engineer routing, job location, fleet tracking" },
    ],
  },
  {
    category: "Payments",
    items: [
      { name: "Stripe", detail: "Subscription billing, invoice payments, deposit collection" },
    ],
  },
  {
    category: "Calendars",
    items: [
      { name: "Google Calendar", detail: "Bidirectional job event sync" },
      { name: "Microsoft Outlook", detail: "Bidirectional job event sync" },
    ],
  },
];

export function Integrations() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Integrations — Connect CtrlTrade® To Your Existing Tools"
        description="CtrlTrade® integrates with Xero, QuickBooks, Stripe, Google Calendar, WhatsApp, Twilio, and more. Keep your entire trade business stack in sync."
        canonical="/integrations"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            INTEGRATIONS
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">Ecosystem Integrations</h1>
          <p className="text-lg md:text-xl max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>
            CtrlTrade® acts as the central hub, syncing seamlessly with the tools you already use to run your business.
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="space-y-12">
            {integrationGroups.map((group, gi) => (
              <div key={gi}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{group.category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {group.items.map((item, i) => (
                    <div key={i} className="border border-border bg-card p-5 hover:border-primary transition-colors">
                      <div className="font-bold mb-1">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">Connect Your Entire Stack</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Start your free 1 month trial and connect your existing tools.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── ADD-ONS ──────────────────────────────────────────────────────────────────

const availableAddons = [
  { name: "CtrlAI®", price: "Included", desc: "AI quotes, AI dispatch, AI reporting, and AI insights built into your workflow.", href: "/features" },
  { name: "CtrlVoice®", price: "Add-on", desc: "Integrated VoIP phone system, SMS, WhatsApp business messaging, and call recording.", href: "/features" },
  { name: "CtrlTradePos®", price: "£59.99 / till / month", desc: "Full EPOS system for trade counters, warehouses, and showrooms.", href: "/ctrltradepos" },
  { name: "CtrlWorkflow®", price: "Included", desc: "Trigger-based automation rules — assign jobs, send reminders, escalate payments.", href: "/features" },
  { name: "CtrlCompliance®", price: "Included", desc: "RAMS, risk assessments, method statements, certifications, and compliance tracking.", href: "/features" },
  { name: "CtrlFleet®", price: "Included", desc: "Live vehicle tracking, MOT/service scheduling, mileage logging, and cost tracking.", href: "/features" },
];

const comingSoon = [
  { name: "CtrlUniversity®", desc: "Trade business training, CPD, and certification courses built into the platform." },
  { name: "CtrlRecruit®", desc: "Integrated hiring and recruitment for trade businesses — job boards, applicant tracking, and onboarding." },
  { name: "CtrlInsurance®", desc: "Tailored trade business insurance, compared and managed inside CtrlTrade®." },
  { name: "CtrlLegal®", desc: "Contract templates, legal documents, and dispute support for trade businesses." },
  { name: "CtrlEnergy®", desc: "Commercial energy procurement and management for multi-site trade operators." },
];

export function Addons() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Add-Ons — Extend Your CtrlTrade® Platform"
        description="Extend CtrlTrade® with CtrlAI®, CtrlVoice®, CtrlTradePos®, and more. Most modules are included as standard — add specialist capabilities as your business grows."
        canonical="/addons"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            ADD-ONS
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">Extend Your Platform</h1>
          <p className="text-lg md:text-xl max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>
            Most modules are included as standard. Add specialist capabilities as your business grows.
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl font-bold mb-8">Available Now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableAddons.map((addon, i) => (
              <Link key={i} href={addon.href} className="block group">
                <div className="border border-border bg-card p-6 h-full hover:border-primary transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg">{addon.name}</h3>
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 shrink-0 ml-2">{addon.price}</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{addon.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground mb-8">The CtrlTrade® ecosystem is growing. These modules are in development.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoon.map((addon, i) => (
              <div key={i} className="border border-border bg-background p-6 opacity-70">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg">{addon.name}</h3>
                  <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 shrink-0 ml-2">Coming Soon</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">Start With Everything You Need</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Every account starts with a free 1 month trial — all modules included.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────

const securityItems = [
  { num: "01", title: "GDPR Compliance", desc: "CtrlTrade® is built to meet GDPR requirements. Data is processed and stored within the UK and EU. Data processing agreements available on request." },
  { num: "02", title: "Tenant Isolation", desc: "Every CtrlTrade® account is fully isolated at the data layer. No cross-tenant data access is possible by design. Multi-tenancy built into every query." },
  { num: "03", title: "Bank-Grade Encryption", desc: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). The same cryptographic standards used by financial institutions." },
  { num: "04", title: "Immutable Audit Logs", desc: "Every critical action is permanently recorded — who changed what, when, and from where. Surfaced to Super Admin and tenant managers." },
  { num: "05", title: "Multi-Factor Authentication", desc: "MFA is available for all user accounts. Enforce MFA across your organisation from the security settings." },
  { num: "06", title: "Secure Backups", desc: "Automated daily backups with point-in-time recovery. Hosted on enterprise cloud infrastructure with multi-zone redundancy." },
];

export function Security() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Security & Compliance — GDPR, Encryption & Data Protection"
        description="CtrlTrade® is engineered to exceed compliance and security standards. GDPR-compliant, AES-256 encryption, tenant isolation, MFA, and immutable audit logs."
        canonical="/security"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <ShieldCheck className="h-16 w-16 text-primary mx-auto mb-6" />
          <div className="inline-block px-4 py-1 mb-6 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            SECURITY & COMPLIANCE
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">Your Data Is Fortified</h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            CtrlTrade® is engineered to exceed compliance and security standards for trade businesses.
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-6">
            {securityItems.map((item, i) => (
              <div key={i} className="border border-border p-8 bg-card flex gap-6 hover:border-primary transition-colors">
                <div className="w-12 h-12 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm font-mono">{item.num}</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Questions About Security?</h2>
          <p className="text-muted-foreground text-lg mb-8">Contact our team for security documentation, DPAs, or penetration test results.</p>
          <Link href="/contact">
            <Button size="lg" variant="outline" className="rounded-xl h-12 px-8">Contact Us</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── CONTACT ──────────────────────────────────────────────────────────────────

export function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createLead = useCreatePlatformLead({ mutation: { onSuccess: () => setSubmitted(true) } });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    createLead.mutate({
      data: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        message: message.trim() || undefined,
        source: "contact_form",
      },
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Contact Us — Get In Touch With CtrlTrade®"
        description="Questions about pricing, implementation, or data migration? Contact the CtrlTrade® team — we're here to help trade businesses get up and running."
        canonical="/contact"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CONTACT
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4 leading-tight">Get In Touch</h1>
          <p className="text-lg" style={{ color: "hsl(220,25%,62%)" }}>Questions about the platform, pricing, or implementation? We're here to help.</p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-bold mb-6">Contact CtrlTrade®</h2>
              <p className="text-lg text-muted-foreground mb-10">Whether you have questions about pricing, need a data migration, or want to discuss a custom implementation — reach out below.</p>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-border flex items-center justify-center bg-card">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Support</div>
                    <div className="font-mono font-bold">support@ctrltrade.io</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-border flex items-center justify-center bg-card">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Headquarters</div>
                    <div className="font-mono font-bold">London, UK</div>
                  </div>
                </div>
                <div className="border border-border bg-card p-6">
                  <h3 className="font-bold mb-3">Already a customer?</h3>
                  <p className="text-sm text-muted-foreground mb-4">Log in to access in-app support, or email support@ctrltrade.io with your account details.</p>
                  <Link href="/login">
                    <Button variant="outline" size="sm">Log In</Button>
                  </Link>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="border border-border p-10 bg-card flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 border border-primary flex items-center justify-center bg-background">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Message Sent</h3>
                <p className="text-muted-foreground">We'll be in touch within one business day.</p>
              </div>
            ) : (
              <form className="space-y-5 border border-border p-8 bg-card" onSubmit={handleSubmit}>
                <h3 className="text-2xl font-bold mb-6">Send A Message</h3>
                {[
                  { label: "Name *", type: "text", value: name, onChange: setName, required: true, testId: "input-contact-name" },
                  { label: "Email *", type: "email", value: email, onChange: setEmail, required: true, testId: "input-contact-email" },
                  { label: "Phone", type: "tel", value: phone, onChange: setPhone, required: false, testId: "input-contact-phone" },
                  { label: "Company", type: "text", value: company, onChange: setCompany, required: false, testId: "input-contact-company" },
                ].map(field => (
                  <div key={field.label}>
                    <label className="block text-sm font-bold mb-2">{field.label}</label>
                    <input type={field.type} required={field.required} value={field.value}
                      onChange={e => field.onChange(e.target.value)}
                      className="w-full border border-border bg-background p-3 rounded-xl focus:outline-none focus:border-primary transition-colors"
                      data-testid={field.testId} />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-bold mb-2">Message</label>
                  <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
                    className="w-full border border-border bg-background p-3 rounded-xl focus:outline-none focus:border-primary transition-colors resize-none"
                    data-testid="input-contact-message" />
                </div>
                <Button type="submit" disabled={createLead.isPending || !name.trim() || !email.trim()}
                  className="w-full rounded-xl h-12 font-bold text-sm" data-testid="button-contact-submit">
                  {createLead.isPending ? "Sending…" : "Send Message"}
                </Button>
                {createLead.isError && <p className="text-sm text-red-500 font-mono text-center">Failed to send. Please try again.</p>}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
