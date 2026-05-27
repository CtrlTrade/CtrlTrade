import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout, useStopImpersonation, useListIntegrations } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Briefcase, FileText, FileSpreadsheet, Calendar, Truck, ShieldCheck, ShoppingCart, BarChart, Settings, LogOut, CreditCard, Target, Inbox, Package, Warehouse, Handshake, Zap, Phone, ClipboardList } from "lucide-react";
import { useGetInboxUnreadCount } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function InboxBadge() {
  const { data } = useGetInboxUnreadCount({ query: { refetchInterval: 30000 } as any });
  if (!data || data.count <= 0) return null;
  return (
    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5" data-testid="badge-inbox-unread">
      {data.count}
    </Badge>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const qc = useQueryClient();
  const stopImp = useStopImpersonation({ mutation: { onSuccess: () => { qc.invalidateQueries(); setLocation("~/admin/tenants"); } } });
  const { data: integrations } = useListIntegrations();
  const failedIntegration = (integrations ?? []).find((i) => i.status === "error");
  const unauthorized = !isLoading && (!session || !session.tenant);

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

  if (isLoading || unauthorized || !session || !session.tenant) {
    return <div className="p-8"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  const tenant = session.tenant;

  const links = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/leads", icon: Target, label: "Leads" },
    { href: "/customers", icon: Users, label: "Customers" },
    { href: "/inbox", icon: Inbox, label: "Inbox" },
    { href: "/jobs", icon: Briefcase, label: "Jobs" },
    { href: "/quotes", icon: FileText, label: "Quotes" },
    { href: "/invoices", icon: FileSpreadsheet, label: "Invoices" },
    { href: "/schedule", icon: Calendar, label: "Schedule" },
    { href: "/fleet", icon: Truck, label: "Fleet" },
    { href: "/timesheets", icon: ClipboardList, label: "Timesheets" },
    { href: "/compliance", icon: ShieldCheck, label: "Compliance" },
    { href: "/pos", icon: ShoppingCart, label: "CtrlTradePos®" },
    { href: "/products", icon: Package, label: "Products" },
    { href: "/stock", icon: Warehouse, label: "Stock" },
    { href: "/suppliers", icon: Truck, label: "Suppliers" },
    { href: "/trade-accounts", icon: Handshake, label: "Trade Accounts" },
    { href: "/reports", icon: BarChart, label: "Reports" },
    { href: "/automation", icon: Zap, label: "CtrlWorkflow" },
    { href: "/voice", icon: Phone, label: "CtrlVoice" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/billing", icon: CreditCard, label: "Billing" },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar">
          <img
            src="/assets/ctrltrade-logo.png"
            alt="CtrlTrade"
            className="h-8 w-auto object-contain"
          />
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            const showBadge = link.href === "/inbox";
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} data-testid={`nav-${link.label.toLowerCase()}`}>
                <link.icon className="h-4 w-4" />
                <span className="flex-1">{link.label}</span>
                {showBadge && <InboxBadge />}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        {failedIntegration && (
          <div className="bg-red-600 text-white px-6 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider" data-testid="banner-integration-failure">
            <span>Integration disconnected: {failedIntegration.provider} — {failedIntegration.lastError ?? "sync failed"}</span>
            <Link href="/settings?tab=integrations" className="underline" data-testid="link-reconnect-integration">Reconnect</Link>
          </div>
        )}
        {session.impersonation && (
          <div className="bg-amber-500 text-black px-6 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider" data-testid="banner-impersonation">
            <span>Impersonating {session.impersonation.tenantName} as {session.impersonation.impersonatorEmail}</span>
            <Button size="sm" variant="outline" className="h-7 border-black text-black hover:bg-black hover:text-amber-500" onClick={() => stopImp.mutate()} data-testid="button-stop-impersonation">Stop impersonating</Button>
          </div>
        )}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: tenant.brandColor || 'var(--primary)' }} />
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
