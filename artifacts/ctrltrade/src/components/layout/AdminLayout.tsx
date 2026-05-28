import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout, useStopImpersonation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, LogOut, Flag, Activity, Cpu, Handshake,
  BarChart3, Plug, ShieldCheck, Funnel, Menu, X, ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Overview", testId: "overview" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/tenants", icon: Users, label: "Tenants", testId: "tenants" },
      { href: "/compliance", icon: ShieldCheck, label: "Compliance", testId: "compliance" },
      { href: "/leads", icon: Funnel, label: "Leads", testId: "leads" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/feature-flags", icon: Flag, label: "Feature Flags", testId: "feature-flags" },
      { href: "/workers", icon: Cpu, label: "Workers", testId: "workers" },
      { href: "/usage", icon: Activity, label: "Usage", testId: "usage" },
      { href: "/referrals", icon: Handshake, label: "Referrals", testId: "referrals" },
      { href: "/reports", icon: BarChart3, label: "Reports", testId: "reports" },
      { href: "/integrations", icon: Plug, label: "Integrations", testId: "integrations" },
    ],
  },
];

function NavItems({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsed[group.label];
        return (
          <div key={group.label}>
            <button
              className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-400 transition-colors"
              onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !c[group.label] }))}
            >
              {group.label}
              <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
            </button>
            {!isCollapsed && (
              <div className="mt-1 space-y-0.5">
                {group.items.map((link) => {
                  const active =
                    location === link.href ||
                    (link.href !== "/" && location.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                      data-testid={`nav-admin-${link.testId}`}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const stopImpersonation = useStopImpersonation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unauthorized = !isLoading && (!session || !session.user.isSuperAdmin);
  const isImpersonating = !!(session as any)?.impersonation;

  useEffect(() => {
    if (unauthorized) setLocation("~/login");
  }, [unauthorized, setLocation]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("~/login") });
  };

  const handleStopImpersonation = () => {
    stopImpersonation.mutate(undefined, {
      onSuccess: () => setLocation("~/admin"),
    });
  };

  if (isLoading || unauthorized || !session) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border bg-sidebar shrink-0">
        <img
          src="/assets/ctrltrade-logo.png"
          alt="CtrlTrade"
          className="h-7 w-auto object-contain"
        />
        <span className="text-xs font-bold uppercase tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5 ml-1">
          Admin
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <NavItems location={location} onNavigate={() => setMobileOpen(false)} />
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex-col hidden md:flex shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
            <button
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-bold gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                You are impersonating{" "}
                <span className="underline">
                  {(session as any).impersonation?.tenantName ?? "a tenant"}
                </span>
                . All actions are audited.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-none border-black bg-transparent text-black hover:bg-black/10 uppercase font-bold text-xs"
              onClick={handleStopImpersonation}
              disabled={stopImpersonation.isPending}
              data-testid="button-stop-impersonation"
            >
              Stop Impersonating
            </Button>
          </div>
        )}

        {/* Top header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-white"
            onClick={() => setMobileOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-sm font-medium text-muted-foreground hidden sm:block">
              {session.user.email}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              data-testid="button-admin-logout"
              className="gap-2 uppercase text-xs tracking-wider font-bold"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
