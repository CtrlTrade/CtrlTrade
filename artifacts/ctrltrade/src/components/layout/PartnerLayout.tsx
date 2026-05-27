import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetPartnerMe, usePartnerLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Link2, DollarSign, Wallet, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PartnerLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data, isLoading, error } = useGetPartnerMe({ query: { retry: false, queryKey: ["partner-me"] } });
  const qc = useQueryClient();
  const logout = usePartnerLogout({
    mutation: {
      onSuccess: () => {
        qc.clear();
        setLocation("~/partner/login");
      },
    },
  });
  const unauthorized = !isLoading && (!data?.partner || !!error);

  useEffect(() => {
    if (unauthorized) setLocation("~/partner/login");
  }, [unauthorized, setLocation]);

  if (isLoading || unauthorized || !data?.partner) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const partner = data.partner;
  const links = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/links", icon: Link2, label: "Links" },
    { href: "/commissions", icon: DollarSign, label: "Commissions" },
    { href: "/payouts", icon: Wallet, label: "Payouts" },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
          <span className="font-bold text-lg tracking-tighter uppercase">CTRLTRADE® Partners</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} data-testid={`nav-partner-${link.label.toLowerCase()}`}>
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/80">
          <div className="font-bold uppercase tracking-wider">{partner.name}</div>
          <div className="opacity-70">{partner.email}</div>
          <div className="mt-2 inline-block bg-sidebar-accent/40 px-2 py-0.5 uppercase tracking-wider">{partner.status}</div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <span className="font-bold text-lg uppercase tracking-tight">Partner Portal</span>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()} data-testid="button-partner-logout" className="gap-2 uppercase text-xs tracking-wider font-bold">
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
