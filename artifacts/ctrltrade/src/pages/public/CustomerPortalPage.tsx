import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileText, CreditCard, MapPin, Star, MessageCircle, CheckCircle2,
  Globe, ArrowRight, Lock, Bell, Share2
} from "lucide-react";

const features = [
  { icon: FileText, title: "Quote Approval", desc: "Customers receive quotes by email, review line items, and approve with a digital signature — from any device." },
  { icon: CreditCard, title: "Invoice Payments", desc: "Customers pay invoices online via Stripe. Card payments, bank transfer, or deposit links on quote acceptance." },
  { icon: MapPin, title: "Job Tracking", desc: "Live job status updates from assignment through to completion. Customers always know what's happening." },
  { icon: MessageCircle, title: "Messaging", desc: "Two-way messaging between customer and your team — all logged against the job record in the CRM." },
  { icon: Star, title: "Reviews", desc: "Request reviews after job completion. Responses visible to your team in the CRM." },
  { icon: Bell, title: "Notifications", desc: "Email notifications when quotes are ready, jobs are scheduled, and invoices are raised." },
  { icon: Share2, title: "Referrals", desc: "Customers can refer friends and businesses directly from the portal — with a unique referral link." },
  { icon: Lock, title: "Secure Access", desc: "Magic link login — no passwords for customers. Secure, tenanted, and branded to your business." },
];

export function CustomerPortalPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CUSTOMER PORTAL
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">Give Customers 24/7 Access</h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            A branded self-service portal where your customers can accept quotes, pay invoices, track jobs, and leave reviews — without calling your office.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-8 text-base font-semibold w-full sm:w-auto">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(220,25%,62%)" }}>
              <Globe className="h-4 w-4" />
              <span>Included with every account</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Portal Features</h2>
            <p className="text-muted-foreground text-lg">Everything your customers need, in one place — branded to your business.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((f, i) => (
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">The Customer Journey</h2>
              <p className="text-lg text-muted-foreground mb-8">From quote to paid invoice, your customers have full visibility — reducing calls to your office and speeding up payments.</p>
              <div className="space-y-4">
                {[
                  { step: "01", label: "Quote received by email", desc: "Customer clicks the secure link in the email" },
                  { step: "02", label: "Reviews quote online", desc: "Line items, photos, and terms visible on mobile" },
                  { step: "03", label: "Signs and pays deposit", desc: "Digital signature + card payment in one step" },
                  { step: "04", label: "Tracks job progress", desc: "Live status updates from your team" },
                  { step: "05", label: "Receives and pays invoice", desc: "Invoice arrives by email, paid online in seconds" },
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
            <div className="border border-border bg-background p-6 shadow-lg">
              <div className="border-b border-border pb-4 mb-4 flex items-center justify-between">
                <div className="font-bold text-sm">Customer Portal</div>
                <div className="text-xs text-muted-foreground">Smith Plumbing Co.</div>
              </div>
              <div className="space-y-3">
                <div className="border border-green-500/30 bg-green-500/5 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-sm">Quote #Q-0842</div>
                    <div className="text-xs bg-yellow-500/20 text-yellow-700 font-bold px-2 py-0.5">Awaiting Approval</div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-foreground mb-3">£2,450.00</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="border border-border bg-background text-xs font-bold py-2 px-3 hover:border-primary transition-colors">VIEW DETAILS</button>
                    <button className="bg-primary text-primary-foreground text-xs font-bold py-2 px-3">APPROVE & PAY</button>
                  </div>
                </div>
                <div className="border border-border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-sm">Job #J-0412</div>
                    <div className="text-xs bg-blue-500/20 text-blue-700 font-bold px-2 py-0.5">In Progress</div>
                  </div>
                  <div className="text-sm text-muted-foreground">Boiler replacement — 14 Elm Street</div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span>Engineer on site today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="mb-10">
            <h2 className="text-3xl font-bold mb-4">Branded To Your Business</h2>
            <p className="text-muted-foreground text-lg">Your logo, your colours, your domain. Customers never know it's CtrlTrade — they just see your brand.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { label: "Custom Logo", desc: "Your logo appears on all portal pages and emails" },
              { label: "Brand Colours", desc: "Portal matches your website and brand identity" },
              { label: "Custom Domain", desc: "Run the portal on your own domain (white-label plans)" },
            ].map((item, i) => (
              <div key={i} className="border border-border bg-card p-6">
                <CheckCircle2 className="h-5 w-5 text-primary mb-3" />
                <div className="font-bold mb-1">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Included With Every Account</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>The Customer Portal is included as standard — no extra cost.</p>
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
