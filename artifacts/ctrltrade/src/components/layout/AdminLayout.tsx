import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout, useStopImpersonation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, LogOut, Flag, Activity, Cpu, Handshake,
  BarChart3, Plug, ShieldCheck, Funnel, Menu, X, ChevronRight,
  AlertTriangle, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_GROUPS = [
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/",           icon: LayoutDashboard, label: "Overview",   testId: "overview"   },
      { href: "/tenants",    icon: Users,           label: "Tenants",    testId: "tenants"    },
      { href: "/compliance", icon: ShieldCheck,     label: "Compliance", testId: "compliance" },
      { href: "/leads",      icon: Funnel,          label: "Leads",      testId: "leads"      },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    items: [
      { href: "/usage",     icon: Activity,  label: "Usage",     testId: "usage"     },
      { href: "/reports",   icon: BarChart3, label: "Reports",   testId: "reports"   },
      { href: "/referrals", icon: Handshake, label: "Referrals", testId: "referrals" },
    ],
  },
  {
    id: "config",
    label: "Config",
    items: [
      { href: "/feature-flags",  icon: Flag, label: "Feature Flags",  testId: "feature-flags"  },
      { href: "/workers",        icon: Cpu,  label: "Workers",        testId: "workers"        },
      { href: "/integrations",   icon: Plug, label: "Integrations",   testId: "integrations"   },
    ],
  },
];

const COLLAPSED_KEY = "admin-sidebar-collapsed";

function NavItem({
  href, icon: Icon, label, active, collapsed, onClick,
}: {
  href: string; icon: React.ElementType; label: string;
  active: boolean; collapsed: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      }`}
      data-testid={`nav-admin-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

function SidebarContent({
  location,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  location: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Brand header */}
      <div className={`h-16 flex items-center border-b border-sidebar-border bg-sidebar shrink-0 ${collapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
        {!collapsed && (
          <>
            <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-7 w-auto object-contain" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5 ml-1">
              Admin
            </span>
          </>
        )}
        {collapsed && (
          <img src="/assets/ctrltrade-logo.png" alt="CtrlTrade" className="h-6 w-auto object-contain" />
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {group.label}
              </div>
            )}
            {collapsed && (
              <div className="border-t border-sidebar-border mt-1 pt-1" />
            )}
            <div className="space-y-0.5">
              {group.items.map((link) => {
                const active =
                  location === link.href ||
                  (link.href !== "/" && location.startsWith(link.href));
                return (
                  <NavItem
                    key={link.href}
                    href={link.href}
                    icon={link.icon}
                    label={link.label}
                    active={active}
                    collapsed={collapsed}
                    onClick={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <div className="p-2 border-t border-sidebar-border shrink-0">
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase text-zinc-500 hover:text-zinc-300 hover:bg-sidebar-accent/50 transition-colors ${collapsed ? "justify-center" : ""}`}
            data-testid="button-sidebar-collapse"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      )}
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const stopImpersonation = useStopImpersonation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });

  const unauthorized = !isLoading && (!session || !session.user.isSuperAdmin);
  const isImpersonating = !!(session as any)?.impersonation;

  useEffect(() => {
    if (unauthorized) setLocation("~/login");
  }, [unauthorized, setLocation]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleToggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

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

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      {/* Desktop sidebar — collapsed = 56px rail, expanded = 256px */}
      <aside
        className={`hidden md:flex flex-col border-r border-sidebar-border bg-sidebar shrink-0 transition-all duration-200 ${
          collapsed ? "w-14" : "w-64"
        }`}
      >
        <SidebarContent
          location={location}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
            <button
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              location={location}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-bold gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Impersonating{" "}
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
