import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) setProductsOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            <img src="/assets/ctrltrade-logo-transparent.png" alt="CtrlTrade" className="h-16 w-auto object-contain" />
          </Link>

          <nav className="hidden lg:flex items-center text-sm font-medium">
            <div ref={productsRef} className="relative">
              <button
                className="flex items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setProductsOpen(o => !o); setMoreOpen(false); }}
              >
                Products <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {productsOpen && (
                <div className="absolute top-full left-0 mt-1 w-60 bg-card border border-border shadow-xl z-50">
                  <Link href="/features" onClick={() => setProductsOpen(false)} className="block px-4 py-3 text-sm hover:bg-muted transition-colors">
                    <div className="font-semibold">Features</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Full platform overview</div>
                  </Link>
                  <Link href="/crm" onClick={() => setProductsOpen(false)} className="block px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border/40">
                    <div className="font-semibold">CtrlTrade CRM</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Leads, jobs, invoicing</div>
                  </Link>
                  <Link href="/epos" onClick={() => setProductsOpen(false)} className="block px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border/40">
                    <div className="font-semibold">CtrlTradePos®</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Trade counter EPOS</div>
                  </Link>
                  <Link href="/customer-portal" onClick={() => setProductsOpen(false)} className="block px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border/40">
                    <div className="font-semibold">Customer Portal</div>
                    <div className="text-xs text-muted-foreground mt-0.5">24/7 customer self-service</div>
                  </Link>
                </div>
              )}
            </div>

            <Link href="/pricing" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/industries" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Industries</Link>
            <Link href="/integrations" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Integrations</Link>
            <Link href="/marketplace" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Marketplace</Link>

            <div ref={moreRef} className="relative">
              <button
                className="flex items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setMoreOpen(o => !o); setProductsOpen(false); }}
              >
                More <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-card border border-border shadow-xl z-50">
                  {[
                    { href: "/addons", label: "Add-ons" },
                    { href: "/security", label: "Security" },
                    { href: "/blog", label: "Blog" },
                    { href: "/about", label: "About" },
                    { href: "/contact", label: "Contact" },
                    { href: "/status", label: "Status" },
                  ].map((l, i) => (
                    <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)}
                      className={`block px-4 py-3 text-sm hover:bg-muted transition-colors${i > 0 ? " border-t border-border/40" : ""}`}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
            <Link href="/signup">
              <Button className="font-bold text-xs whitespace-nowrap" data-testid="link-signup">
                <span className="hidden sm:inline">Start Free 1 Month Trial</span>
                <span className="sm:hidden">Free Trial</span>
              </Button>
            </Link>
            <button className="lg:hidden p-2 -mr-2 text-foreground" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-card max-h-[80vh] overflow-y-auto">
            <nav className="container mx-auto px-4 py-3 flex flex-col">
              {[
                { href: "/features", label: "Features" },
                { href: "/crm", label: "CRM" },
                { href: "/epos", label: "CtrlTradePos®" },
                { href: "/customer-portal", label: "Customer Portal" },
                { href: "/pricing", label: "Pricing" },
                { href: "/industries", label: "Industries" },
                { href: "/integrations", label: "Integrations" },
                { href: "/marketplace", label: "Marketplace" },
                { href: "/addons", label: "Add-ons" },
                { href: "/security", label: "Security" },
                { href: "/blog", label: "Blog" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
                { href: "/status", label: "Status" },
                { href: "/login", label: "Log in" },
              ].map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium py-2.5 text-muted-foreground hover:text-foreground transition-colors border-b border-border/30 last:border-0">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4">
                <img src="/assets/ctrltrade-logo-transparent.png" alt="CtrlTrade" className="h-10 w-auto object-contain" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">The complete operating system for trade businesses.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider">Product</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  { href: "/features", label: "Features" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/crm", label: "CRM" },
                  { href: "/epos", label: "CtrlTradePos®" },
                  { href: "/customer-portal", label: "Customer Portal" },
                  { href: "/addons", label: "Add-ons" },
                ].map(l => <li key={l.href}><Link href={l.href} className="hover:text-foreground transition-colors">{l.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider">Industries</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  { href: "/roofing-crm", label: "Roofing" },
                  { href: "/electrical-crm", label: "Electrical" },
                  { href: "/plumbing-crm", label: "Plumbing" },
                  { href: "/hvac-crm", label: "HVAC" },
                  { href: "/trade-counter-epos", label: "Trade Counter" },
                  { href: "/industries", label: "All Industries →" },
                ].map(l => <li key={l.href}><Link href={l.href} className="hover:text-foreground transition-colors">{l.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider">Company</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  { href: "/about", label: "About" },
                  { href: "/blog", label: "Blog" },
                  { href: "/integrations", label: "Integrations" },
                  { href: "/security", label: "Security" },
                  { href: "/contact", label: "Contact" },
                  { href: "/status", label: "Status" },
                ].map(l => <li key={l.href}><Link href={l.href} className="hover:text-foreground transition-colors">{l.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider">Legal</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {year} CtrlTrade®. All rights reserved. CtrlTradePos® is a registered trademark.</p>
            <Link href="/signup">
              <Button size="sm" className="font-bold text-xs">Start Free 1 Month Trial</Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
