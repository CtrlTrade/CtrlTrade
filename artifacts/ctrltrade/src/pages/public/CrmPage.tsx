import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Users, FileText, Briefcase, CalendarCheck, MapPin, Receipt,
  Truck, ShieldCheck, Zap, CheckCircle2, ArrowRight, Phone,
  BarChart3, Mail, Clock, Star
} from "lucide-react";
import { PageHead } from "@/components/PageHead";

const features = [
  { icon: Users, title: "Lead Management", desc: "Capture leads from web forms, phone calls, and lead platforms. Score, assign, and track every enquiry from first contact to won job." },
  { icon: FileText, title: "Quote Engine", desc: "Build branded quotes with line items, labour, materials, and VAT. Send digitally for e-signature and deposit payment." },
  { icon: Briefcase, title: "Job Management", desc: "End-to-end job tracking from initial callout to completion sign-off. Assign engineers, track time, and capture compliance data." },
  { icon: CalendarCheck, title: "Scheduling & Dispatch", desc: "Drag-and-drop calendar board with intelligent routing. See engineer availability and dispatch with one click." },
  { icon: Receipt, title: "Invoicing", desc: "Convert completed jobs to invoices instantly. Chase late payments automatically. Accept card payments via the customer portal." },
  { icon: Truck, title: "Fleet Management", desc: "Track vehicle locations, log MOT/service dates, record mileage and fuel costs across your entire fleet." },
  { icon: ShieldCheck, title: "Compliance & Safety", desc: "Built-in RAMS, risk assessments, method statements, and certification tracking with automated expiry alerts." },
  { icon: Phone, title: "CtrlVoice® VoIP", desc: "Integrated phone system with call recording, SMS, and WhatsApp. All communications logged to the customer record." },
  { icon: BarChart3, title: "Reporting & Analytics", desc: "Revenue reports, job profitability, lead ROI, engineer performance, and aged debtors — all built in." },
  { icon: Zap, title: "Automation Rules", desc: "Build trigger-based automations: auto-assign jobs, send quote reminders, escalate overdue payments, notify customers." },
  { icon: Mail, title: "Customer Portal", desc: "Branded portal where customers can accept quotes, pay invoices, track jobs, and leave reviews — 24/7." },
  { icon: Star, title: "Marketplace", desc: "List your business on the CtrlTrade Marketplace. Find subcontractors, source suppliers, and exchange labour." },
];

const compareRows = [
  { feature: "CRM & Job Management", ctrl: true },
  { feature: "Digital Quotes & E-signatures", ctrl: true },
  { feature: "Customer Portal", ctrl: true },
  { feature: "Integrated EPOS", ctrl: true },
  { feature: "Warehouse Management", ctrl: true },
  { feature: "Built-in VoIP & SMS", ctrl: true },
  { feature: "AI Features", ctrl: true },
  { feature: "Marketplace", ctrl: true },
  { feature: "Trade Account Billing", ctrl: true },
  { feature: "Compliance Module", ctrl: true },
];

export function CrmPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="CRM Software For Trade Businesses"
        description="CtrlTrade® CRM handles leads, quotes, jobs, scheduling, invoicing, fleet, compliance, and more — all in one platform built for trade businesses."
        canonical="/crm"
      />
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CTRLTRADE CRM
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">Everything You Need To Run A Trade Business</h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            Manage leads, customers, quotes, jobs, scheduling, invoicing, compliance, and fleet — all in one connected platform built for trade businesses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-8 text-base font-semibold w-full sm:w-auto">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-base font-semibold bg-transparent w-full sm:w-auto" style={{ borderColor: "hsla(215,30%,93%,0.4)", color: "hsl(215,30%,93%)" }}>
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Full CRM Feature Set</h2>
            <p className="text-muted-foreground text-lg">Every module you need — no add-on pricing traps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((f, i) => (
              <div key={i} className="border border-border bg-card p-8 hover:border-primary transition-colors group">
                <f.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Built For Every Stage Of The Job</h2>
              <p className="text-lg text-muted-foreground mb-8">From the first enquiry to the final invoice, every step of your workflow is handled inside one platform. No switching apps, no data re-entry.</p>
              <div className="space-y-4">
                {[
                  { step: "01", label: "Lead arrives", desc: "Web form, phone call, or lead platform" },
                  { step: "02", label: "Quote sent", desc: "Professional quote with e-signature" },
                  { step: "03", label: "Job created", desc: "Assigned to engineer, scheduled on calendar" },
                  { step: "04", label: "Job completed", desc: "Photos, forms, compliance logged" },
                  { step: "05", label: "Invoice sent", desc: "Auto-generated, paid via portal" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="w-10 h-10 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm font-mono">{s.step}</div>
                    <div>
                      <div className="font-bold">{s.label}</div>
                      <div className="text-sm text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="border border-border bg-background p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-sm">Dashboard Overview</div>
                  <div className="text-xs text-muted-foreground">Today</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Open Jobs", value: "24", color: "text-blue-500" },
                    { label: "Pending Quotes", value: "8", color: "text-yellow-500" },
                    { label: "Invoiced Today", value: "£4,280", color: "text-green-500" },
                    { label: "Overdue", value: "3", color: "text-red-500" },
                  ].map(stat => (
                    <div key={stat.label} className="border border-border p-4 bg-card">
                      <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-border bg-background p-4">
                <div className="text-xs font-bold mb-2 text-muted-foreground">RECENT JOBS</div>
                {["Boiler Service — 9 Maple Ave", "Rewire — Commercial Unit B4", "Roof Survey — 42 Oak Lane"].map(j => (
                  <div key={j} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <div className="text-sm truncate">{j}</div>
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">CtrlTrade vs. Everything Else</h2>
            <p className="text-muted-foreground">The only platform built for both field service <em>and</em> trade counter operations.</p>
          </div>
          <div className="border border-border overflow-hidden">
            <div className="grid grid-cols-2 bg-muted/30 border-b border-border">
              <div className="p-4 font-bold text-sm">Feature</div>
              <div className="p-4 font-bold text-sm text-primary text-center">CtrlTrade®</div>
            </div>
            {compareRows.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 border-b border-border/50 last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <div className="p-4 text-sm">{row.feature}</div>
                <div className="p-4 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready To Take Control?</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Start your free 1 month trial — no credit card required during trial.</p>
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
