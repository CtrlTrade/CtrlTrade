import { Link, useLocation } from "wouter";
import { useGetSession, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Briefcase, FileText, FileSpreadsheet, Calendar, Truck, ShieldCheck, ShoppingCart, BarChart, Settings, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      }
    });
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  if (!session || !session.tenant) {
    setLocation("/login");
    return null;
  }

  const tenant = session.tenant;

  const links = [
    { href: "/app", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/app/customers", icon: Users, label: "Customers" },
    { href: "/app/jobs", icon: Briefcase, label: "Jobs" },
    { href: "/app/quotes", icon: FileText, label: "Quotes" },
    { href: "/app/invoices", icon: FileSpreadsheet, label: "Invoices" },
    { href: "/app/schedule", icon: Calendar, label: "Schedule" },
    { href: "/app/fleet", icon: Truck, label: "Fleet" },
    { href: "/app/compliance", icon: ShieldCheck, label: "Compliance" },
    { href: "/app/pos", icon: ShoppingCart, label: "Pos®" },
    { href: "/app/reports", icon: BarChart, label: "Reports" },
    { href: "/app/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
          <span className="font-bold text-lg tracking-tighter uppercase">CTRLTRADE®</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const active = location === link.href;
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} data-testid={`nav-${link.label.toLowerCase()}`}>
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-none" style={{ backgroundColor: tenant.brandColor || 'var(--primary)' }} />
            <span className="font-bold text-lg uppercase tracking-tight" data-testid="text-tenant-name">{tenant.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground">{session.user.name}</div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout" className="gap-2 uppercase text-xs tracking-wider font-bold">
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
