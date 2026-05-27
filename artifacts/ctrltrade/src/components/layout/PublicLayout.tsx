import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-7 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="/industries" className="text-muted-foreground hover:text-foreground transition-colors">Industries</Link>
            <Link href="/integrations" className="text-muted-foreground hover:text-foreground transition-colors">Integrations</Link>
            <Link href="/addons" className="text-muted-foreground hover:text-foreground transition-colors">Addons</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">Log in</Link>
            <Link href="/signup">
              <Button className="uppercase tracking-wider font-bold text-xs" data-testid="link-signup">Start 1 month free trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-12 mt-20">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-6 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground">The operating system a serious trade business runs on.</p>
          </div>
          <div>
            <h3 className="font-bold mb-4 uppercase text-xs tracking-wider">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/addons" className="hover:text-foreground">Pos® Till</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4 uppercase text-xs tracking-wider">Company</h3>
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
