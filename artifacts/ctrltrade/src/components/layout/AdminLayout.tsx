import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Flag, Activity, Cpu, Handshake } from "lucide-react";
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
  ];

  return (
    <div className="min-h-screen bg-black text-white flex font-sans">
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 border-b border-zinc-800 bg-black text-white">
          <span className="font-bold text-lg tracking-tighter uppercase text-red-500">CTRLTRADE® ADMIN</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`} data-testid={`nav-admin-${link.label.toLowerCase()}`}>
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-zinc-400">{session.user.email}</div>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-admin-logout" className="gap-2 uppercase text-xs tracking-wider font-bold border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto bg-zinc-900 text-zinc-100">
          {children}
        </main>
      </div>
    </div>
  );
}
