import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Flag, Activity, Cpu, Handshake, BarChart3, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const unauthorized = !isLoading && (!session || !session.user.isSuperAdmin);

  useEffect(() => {
    if (unauthorized) setLocation("~/login");
  }, [unauthorized, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("~/login");
      }
    });
  };

  if (isLoading || unauthorized || !session) {
    return <div className="p-8"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  const links = [
    { href: "/", icon: LayoutDashboard, label: "Overview" },
    { href: "/tenants", icon: Users, label: "Tenants" },
    { href: "/feature-flags", icon: Flag, label: "Feature Flags" },
    { href: "/workers", icon: Cpu, label: "Workers" },
    { href: "/usage", icon: Activity, label: "Usage" },
    { href: "/referrals", icon: Handshake, label: "Referrals" },
    { href: "/reports", icon: BarChart3, label: "Reports" },
    { href: "/integrations", icon: Plug, label: "Integrations" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border bg-sidebar">
          <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-7 w-auto object-contain" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5 ml-1">Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} data-testid={`nav-admin-${link.label.toLowerCase()}`}>
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground">{session.user.email}</div>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-admin-logout" className="gap-2 uppercase text-xs tracking-wider font-bold">
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
