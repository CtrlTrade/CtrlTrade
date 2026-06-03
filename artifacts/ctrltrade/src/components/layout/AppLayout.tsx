import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout, useStopImpersonation, useListIntegrations } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, Users, Briefcase, FileText, FileSpreadsheet, Calendar, Truck, ShieldCheck, ShoppingCart, BarChart, Settings, LogOut, CreditCard, Target, Inbox, Package, Warehouse, Handshake, Zap, Phone, ClipboardList, UserX, Building2, UserCog, FolderOpen, Menu } from "lucide-react";
import { useGetInboxUnreadCount } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationBell } from "./NotificationBell";

function InboxBadge() {
  const { data } = useGetInboxUnreadCount({ query: { refetchInterval: 30000 } as any });
  if (!data || data.count <= 0) return null;
  return (
    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5" data-testid="badge-inbox-unread">
      {data.count}
    </Badge>
  );
}

type NavLink = { href: string; icon: typeof LayoutDashboard; label: string };

function NavLinks({ links, location, onNavigate }: { links: NavLink[]; location: string; onNavigate?: () => void }) {
  return (
    <>
      {links.map((link) => {
        const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
        const showBadge = link.href === "/inbox";
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
            data-testid={`nav-${link.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{link.label}</span>
            {showBadge && <InboxBadge />}
          </Link>
        );
      })}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, isLoading, isFetching } = useGetSession();
  const logout = useLogout();
  const qc = useQueryClient();
  const stopImp = useStopImpersonation({ mutation: { onSuccess: () => { qc.invalidateQueries(); setLocation("~/admin/tenants"); } } });
  const { data: integrations } = useListIntegrations();
  const failedIntegration = (integrations ?? []).find((i) => i.status === "error");
  const unauthorized = !isLoading && !isFetching && (!session || !session.tenant);

  useEffect(() => {
    if (unauthorized) setLocation("~/login");
  }, [unauthorized, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("~/login");
      },
    });
  };

  if (isLoading || unauthorized || !session || !session.tenant) {
    return <div className="p-8"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  const tenant = session.tenant as any;
  const posEnabled: boolean = tenant.posEnabled ?? false;
  const hasMobileWorkforce: boolean = tenant.hasMobileWorkforce ?? false;
  const hasTradeShop: boolean = tenant.hasTradeShop ?? false;
  const multiBranchEnabled: boolean = tenant.multiBranchEnabled ?? false;

  const allLinks: Array<{ href: string; icon: typeof LayoutDashboard; label: string; always?: boolean; enabled?: boolean }> = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard", always: true },
    { href: "/leads", icon: Target, label: "Leads", always: true },
    { href: "/customers", icon: Users, label: "Customers", always: true },
    { href: "/inbox", icon: Inbox, label: "Inbox", always: true },
    { href: "/jobs", icon: Briefcase, label: "Jobs", always: true },
    { href: "/projects", icon: FolderOpen, label: "Projects", always: true },
    { href: "/quotes", icon: FileText, label: "Quotes", always: true },
    { href: "/invoices", icon: FileSpreadsheet, label: "Invoices", always: true },
    { href: "/schedule", icon: Calendar, label: "Schedule", always: true },
    { href: "/fleet", icon: Truck, label: "Fleet", always: true },
    { href: "/timesheets", icon: ClipboardList, label: "Timesheets", enabled: hasMobileWorkforce },
    { href: "/availability", icon: UserX, label: "Availability", enabled: hasMobileWorkforce },
    { href: "/compliance", icon: ShieldCheck, label: "Compliance", always: true },
    { href: "/pos", icon: ShoppingCart, label: "CtrlTradePos®", enabled: posEnabled },
    { href: "/products", icon: Package, label: "Products", enabled: hasTradeShop || posEnabled },
    { href: "/stock", icon: Warehouse, label: "Stock", enabled: hasTradeShop || posEnabled },
    { href: "/suppliers", icon: Truck, label: "Suppliers", enabled: hasTradeShop },
    { href: "/trade-accounts", icon: Handshake, label: "Trade Accounts", enabled: hasTradeShop },
    { href: "/reports", icon: BarChart, label: "Reports", always: true },
    { href: "/automation", icon: Zap, label: "CtrlWorkflow", always: true },
    { href: "/voice", icon: Phone, label: "CtrlVoice", always: true },
    { href: "/branches", icon: Building2, label: "Branches", enabled: multiBranchEnabled },
    { href: "/area-managers", icon: UserCog, label: "Area Managers", enabled: multiBranchEnabled },
    { href: "/settings", icon: Settings, label: "Settings", always: true },
    { href: "/billing", icon: CreditCard, label: "Billing", always: true },
  ];

  const links = allLinks.filter((l) => l.always || l.enabled);

  const sidebarFooter = tenant.industrySlug ? (
    <div className="p-4 border-t border-sidebar-border">
      <div className="text-[10px] text-muted-foreground mb-1">Industry</div>
      <div className="text-xs font-semibold">{(tenant.industrySlug as string).replace(/-/g, " ")}</div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar">
          <img
            src="/assets/ctrltrade-logo.png"
            alt="CtrlTrade"
            className="h-8 w-auto object-contain"
          />
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <NavLinks links={links} location={location} />
        </nav>
        {sidebarFooter}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {failedIntegration && (
          <div className="bg-red-600 text-white px-4 sm:px-6 py-2 flex items-center justify-between text-xs font-bold gap-2 flex-wrap" data-testid="banner-integration-failure">
            <span>Integration disconnected: {failedIntegration.provider} — {failedIntegration.lastError ?? "sync failed"}</span>
            <Link href="/settings?tab=integrations" className="underline whitespace-nowrap" data-testid="link-reconnect-integration">Reconnect</Link>
          </div>
        )}
        {session.impersonation && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 px-4 sm:px-6 py-2 flex items-center justify-between text-xs font-semibold gap-2 flex-wrap" data-testid="banner-impersonation">
            <span>Impersonating {session.impersonation.tenantName} as {session.impersonation.impersonatorEmail}</span>
            <Button size="sm" variant="outline" className="h-7 rounded-xl border-amber-500/50 text-amber-300 hover:bg-amber-500/20 shrink-0" onClick={() => stopImp.mutate()} data-testid="button-stop-impersonation">Stop impersonating</Button>
          </div>
        )}

        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-1" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar flex flex-col">
                <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar shrink-0">
                  <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-8 w-auto object-contain" />
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                  <NavLinks links={links} location={location} onNavigate={() => setMobileOpen(false)} />
                </nav>
                {sidebarFooter}
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm shrink-0" style={{ backgroundColor: tenant.brandColor || "var(--primary)" }} />
              <span className="font-bold text-sm sm:text-lg truncate" data-testid="text-tenant-name">{tenant.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationBell />
            <div className="text-sm font-medium text-muted-foreground hidden sm:block truncate max-w-32">{session.user.name}</div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout" className="gap-1 sm:gap-2 text-xs font-semibold px-2 sm:px-3">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
