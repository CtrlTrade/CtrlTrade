import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, CheckCircle2, HardHat, CalendarCheck, FileText, Truck, ShieldCheck, Mail, MapPin } from "lucide-react";

export function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-foreground text-background py-24 md:py-32 relative overflow-hidden">
        {/* Abstract industrial background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-primary text-primary font-bold uppercase tracking-wider text-xs">
            System Online • Trade Operating System
          </div>
          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6 leading-tight">
            The OS a Serious Trade Business Runs On.
          </h1>
          <p className="text-lg md:text-xl text-muted mb-10 max-w-2xl mx-auto">
            Quotes, jobs, scheduling, fleet, compliance, and point-of-sale. All in one industrial-grade platform. CTRLTRADE® is built for operators who demand control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-none h-14 px-8 text-base uppercase font-bold tracking-wider w-full sm:w-auto hover:bg-primary/90" data-testid="button-hero-cta">
                Start 1 month free trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-none h-14 px-8 text-base uppercase font-bold tracking-wider bg-transparent border-background text-background hover:bg-background hover:text-foreground w-full sm:w-auto" data-testid="button-hero-secondary">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold uppercase tracking-tighter mb-4">Command Every Aspect</h2>
            <p className="text-muted-foreground">Stop jumping between five different apps. Bring your entire operation under one roof.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-border p-8 bg-card group hover:border-primary transition-colors">
              <div className="h-12 w-12 bg-muted flex items-center justify-center mb-6 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Total Control</h3>
              <p className="text-muted-foreground text-sm">Manage your back-office and mobile crew seamlessly. Assign jobs, track progress, and invoice instantly from anywhere.</p>
            </div>
            <div className="border border-border p-8 bg-card group hover:border-primary transition-colors">
              <div className="h-12 w-12 bg-muted flex items-center justify-center mb-6 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Industrial Grade</h3>
              <p className="text-muted-foreground text-sm">Built to handle the demands of growing trade firms. Reliable infrastructure, secure data, and fast workflows.</p>
            </div>
            <div className="border border-border p-8 bg-card group hover:border-primary transition-colors">
              <div className="h-12 w-12 bg-muted flex items-center justify-center mb-6 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Integrated POS</h3>
              <p className="text-muted-foreground text-sm">The exclusive CTRLTRADEPos® till system links directly to your inventory, customers, and invoicing in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold uppercase tracking-tighter mb-6">Engineered for the Field</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Your crews need tools that work as hard as they do. The mobile field interface strips away the noise, giving them exactly what they need to execute the job and record compliance data.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold uppercase tracking-tight text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Offline sync capabilities</li>
                <li className="flex items-center gap-3 font-bold uppercase tracking-tight text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> One-tap photo uploads</li>
                <li className="flex items-center gap-3 font-bold uppercase tracking-tight text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Digital signature capture</li>
                <li className="flex items-center gap-3 font-bold uppercase tracking-tight text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Instant parts requisition</li>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 transform translate-x-4 translate-y-4" />
              <div className="border border-border bg-background p-8 relative z-10 shadow-2xl">
                <div className="border-b border-border pb-4 mb-4 flex justify-between items-center">
                  <div className="font-bold uppercase tracking-tighter">Job #8492</div>
                  <div className="px-2 py-1 bg-green-500/20 text-green-700 text-xs font-bold uppercase tracking-wider">In Progress</div>
                </div>
                <div className="space-y-4">
                  <div className="h-4 bg-muted w-3/4" />
                  <div className="h-4 bg-muted w-1/2" />
                  <div className="h-24 bg-muted w-full mt-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function Features() {
  const features = [
    { icon: FileText, title: "Quote Engine", desc: "Build accurate, professional quotes in seconds with pre-loaded parts catalogs and template assemblies." },
    { icon: HardHat, title: "Job Management", desc: "End-to-end tracking from initial callout to final completion sign-off." },
    { icon: CalendarCheck, title: "Smart Scheduling", desc: "Drag-and-drop dispatch board with intelligent routing and availability mapping." },
    { icon: Truck, title: "Fleet Tracking", desc: "Know where your assets are at all times. Log maintenance and track mileage." },
    { icon: ShieldCheck, title: "Compliance & Safety", desc: "Built-in forms and mandatory safety logs to meet industry standards." },
    { icon: Zap, title: "Automated Invoicing", desc: "Convert jobs to invoices instantly. Chase late payments automatically." }
  ];

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-3xl mb-16">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-6">Full Arsenal</h1>
        <p className="text-lg text-muted-foreground">Every tool you need to run the operation. No modular pricing traps — you get the complete system.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <div key={i} className="border border-border p-8 bg-card hover:border-primary transition-all">
            <f.icon className="h-8 w-8 text-primary mb-6" />
            <h3 className="text-xl font-bold uppercase tracking-tight mb-3">{f.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Integrations() {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-6">Ecosystem Integrations</h1>
      <p className="text-lg text-muted-foreground mb-16 max-w-2xl mx-auto">CTRLTRADE® acts as the central hub, syncing seamlessly with the specialized tools you already trust to run your business.</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
        <div className="p-12 border border-border bg-card flex flex-col items-center justify-center hover:border-primary transition-colors">
          <div className="font-bold text-2xl tracking-tighter">XERO</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Accounting</div>
        </div>
        <div className="p-12 border border-border bg-card flex flex-col items-center justify-center hover:border-primary transition-colors">
          <div className="font-bold text-2xl tracking-tighter">QUICKBOOKS</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Accounting</div>
        </div>
        <div className="p-12 border border-border bg-card flex flex-col items-center justify-center hover:border-primary transition-colors">
          <div className="font-bold text-2xl tracking-tighter text-blue-600">STRIPE</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Payments</div>
        </div>
        <div className="p-12 border border-border bg-card flex flex-col items-center justify-center hover:border-primary transition-colors">
          <CalendarCheck className="h-8 w-8 mb-2" />
          <div className="font-bold text-xl tracking-tighter">CALENDARS</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Google / MS</div>
        </div>
      </div>
    </div>
  );
}

export function Addons() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-3xl mb-16">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-6">Hardware Addons</h1>
        <p className="text-lg text-muted-foreground">Extend the digital nervous system of your business into the physical world.</p>
      </div>

      <div className="border border-primary bg-card p-0 flex flex-col md:flex-row">
        <div className="bg-primary/5 p-12 flex-1 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border">
          <div className="inline-block px-3 py-1 bg-primary text-primary-foreground font-bold uppercase text-xs tracking-wider mb-6 self-start">Hardware Standard</div>
          <h2 className="text-3xl font-bold uppercase tracking-tight mb-4">CTRLTRADEPos® Till</h2>
          <p className="text-muted-foreground mb-8 text-lg">The ultimate hardware extension for your trade counter. Sell parts directly to walk-ins while instantly syncing inventory and revenue with your central cloud.</p>
          <div className="text-3xl font-mono font-bold text-primary mb-2">£59.99<span className="text-lg text-muted-foreground font-normal font-sans"> / mo</span></div>
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Includes touchscreen unit & receipt printer</p>
        </div>
        <div className="flex-1 bg-muted/20 flex items-center justify-center p-12 min-h-[300px]">
          {/* Placeholder for hardware image */}
          <div className="w-48 h-64 border-4 border-border bg-card relative shadow-2xl">
            <div className="absolute top-4 left-4 right-4 h-32 bg-muted" />
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-primary rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Security() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <div className="text-center mb-16">
        <ShieldCheck className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-6">Security & Compliance</h1>
        <p className="text-xl text-muted-foreground">
          Your data is fortified. CTRLTRADE® is engineered to exceed compliance standards for the trade industry.
        </p>
      </div>

      <div className="space-y-8">
        <div className="border border-border p-8 bg-card flex gap-6">
          <div className="w-12 h-12 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-mono">01</div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Bank-Grade Encryption</h3>
            <p className="text-muted-foreground">All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We utilize the same cryptographic standards demanded by financial institutions.</p>
          </div>
        </div>
        <div className="border border-border p-8 bg-card flex gap-6">
          <div className="w-12 h-12 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-mono">02</div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Immutable Audit Logs</h3>
            <p className="text-muted-foreground">Every critical action taken within the system is permanently recorded. Know exactly who altered a quote, cancelled a job, or accessed customer records.</p>
          </div>
        </div>
        <div className="border border-border p-8 bg-card flex gap-6">
          <div className="w-12 h-12 shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-mono">03</div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Resilient Infrastructure</h3>
            <p className="text-muted-foreground">Hosted on enterprise cloud providers with redundant daily backups and multi-zone failover. Your operation never goes offline.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter mb-6">Contact Command</h1>
          <p className="text-lg text-muted-foreground mb-10">
            Need custom implementation? Have questions about migrating your data? Reach out to our technical dispatch team.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border border-border flex items-center justify-center bg-card">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Support</div>
                <div className="font-mono font-bold text-lg">dispatch@ctrltrade.com</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border border-border flex items-center justify-center bg-card">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-wider text-xs text-muted-foreground">HQ</div>
                <div className="font-mono font-bold text-lg">London, UK</div>
              </div>
            </div>
          </div>
        </div>
        
        <form className="space-y-6 border border-border p-8 bg-card" onSubmit={(e) => e.preventDefault()}>
          <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">Direct Transmission</h3>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Name</label>
            <input type="text" className="w-full border border-border bg-background p-3 rounded-none focus:outline-none focus:border-primary transition-colors" data-testid="input-contact-name" />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Email</label>
            <input type="email" className="w-full border border-border bg-background p-3 rounded-none focus:outline-none focus:border-primary transition-colors" data-testid="input-contact-email" />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Message</label>
            <textarea rows={5} className="w-full border border-border bg-background p-3 rounded-none focus:outline-none focus:border-primary transition-colors resize-none" data-testid="input-contact-message"></textarea>
          </div>
          <Button className="w-full rounded-none h-12 font-bold uppercase tracking-wider text-sm" data-testid="button-contact-submit">Send Transmission</Button>
        </form>
      </div>
    </div>
  );
}

