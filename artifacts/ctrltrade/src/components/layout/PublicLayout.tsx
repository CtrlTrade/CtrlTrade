import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/pricing", label: "Pricing" },
    { href: "/features", label: "Features" },
    { href: "/industries", label: "Industries" },
    { href: "/integrations", label: "Integrations" },
    { href: "/addons", label: "Addons" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            <img src="/assets/ctrltrade-logo-transparent.png" alt="CtrlTrade" className="h-16 w-auto object-contain" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">Log in</Link>
            <Link href="/signup">
              <Button className="font-bold text-xs whitespace-nowrap" data-testid="link-signup">
                <span className="hidden sm:inline">Start 1 month free trial</span>
                <span className="sm:hidden">Free trial</span>
              </Button>
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -mr-2 text-foreground"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card">
            <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium py-2.5 text-muted-foreground hover:text-foreground transition-colors border-b border-border/40 last:border-0"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-10 sm:py-12 mt-12 sm:mt-20">
        <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <img src="/assets/ctrltrade-logo-transparent.png" alt="CtrlTrade" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground">The operating system a serious trade business runs on.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-xs">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/addons" className="hover:text-foreground">Pos® Till</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-xs">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
