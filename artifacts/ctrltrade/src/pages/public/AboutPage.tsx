import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Users, Zap, Globe } from "lucide-react";
import { PageHead } from "@/components/PageHead";

const values = [
  { icon: Target, title: "Built For Trades", desc: "We only build for trade businesses. Every feature, every workflow, every design decision is made with a trade operator in mind." },
  { icon: Zap, title: "All-In-One", desc: "We believe the best software is software you don't have to think about. CtrlTrade connects CRM, EPOS, portal, and finance in one seamless system." },
  { icon: Users, title: "Operator-First", desc: "We talk to trade business owners every day. Product decisions are driven by real operators running real businesses." },
  { icon: Globe, title: "Built In The UK", desc: "CtrlTrade is built and operated in the UK. GDPR compliant, UK VAT-ready, and built to meet UK trade business standards." },
];

export function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="About CtrlTrade® — Built For Trade Businesses"
        description="CtrlTrade® is built and operated in the UK by a team focused entirely on trade businesses. GDPR compliant, UK VAT-ready, and operator-first by design."
        canonical="/about"
      />
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            ABOUT CTRLTRADE®
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">The Operating System For Trade Businesses</h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            We built CtrlTrade® because trade businesses deserved better software — purpose-built, not adapted from generic platforms.
          </p>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Why We Built CtrlTrade®</h2>
              <div className="space-y-5 text-muted-foreground leading-relaxed">
                <p className="text-lg">Trade businesses have always been underserved by software. Generic CRMs weren't built for job-based workflows. Generic EPOS systems didn't connect to the CRM. Accounting integrations were bolted on as afterthoughts.</p>
                <p>We set out to build the single operating system that a trade business — whether a sole trader, a multi-branch supplier, or a national facilities company — could run their entire operation on.</p>
                <p>CtrlTrade® combines field service CRM, trade counter EPOS (CtrlTradePos®), customer portal, compliance management, fleet tracking, VoIP, and AI — all in one connected platform. No integrations to maintain, no data gaps, no duplication.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-6 py-2">
                <div className="text-3xl font-bold font-mono text-primary mb-1">£59.99</div>
                <div className="text-sm text-muted-foreground">per till per month — including EPOS software</div>
              </div>
              <div className="border-l-4 border-primary pl-6 py-2">
                <div className="text-3xl font-bold font-mono text-primary mb-1">£79</div>
                <div className="text-sm text-muted-foreground">per control seat per month — CRM + all modules</div>
              </div>
              <div className="border-l-4 border-primary pl-6 py-2">
                <div className="text-3xl font-bold font-mono text-primary mb-1">1 Month</div>
                <div className="text-sm text-muted-foreground">free trial — no credit card required</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What We Stand For</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <div key={i} className="border border-border bg-background p-8 hover:border-primary transition-colors">
                <v.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-3">{v.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built For These Businesses</h2>
            <p className="text-muted-foreground text-lg">CtrlTrade® is designed specifically for trade and field service operators.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              "Sole Traders", "Trade Businesses", "Suppliers", "Trade Counters",
              "Warehouses", "Showrooms", "Field Service Companies", "Multi-Branch Operators",
            ].map((item, i) => (
              <div key={i} className="border border-border bg-card p-4 text-center text-sm font-medium hover:border-primary transition-colors">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready To Take Control?</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Start your free 1 month trial today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-10 text-base font-bold">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-base font-semibold bg-transparent" style={{ borderColor: "hsla(215,30%,93%,0.4)", color: "hsl(215,30%,93%)" }}>
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
