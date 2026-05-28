import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useGetPortalBranding, useGetPortalSession, usePortalLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: branding } = useGetPortalBranding(tenantSlug);
  const { data: session } = useGetPortalSession({ query: { retry: false, queryKey: ["portal-session"] } });
  const logout = usePortalLogout({
    mutation: {
      onSuccess: () => {
        window.location.href = `/portal/${tenantSlug}`;
      },
    },
  });

  useEffect(() => {
    if (branding?.brandColor) {
      document.documentElement.style.setProperty("--primary", branding.brandColor);
    }
  }, [branding?.brandColor]);

  const tenantName = branding?.productName ?? branding?.tenantName ?? "Customer Portal";
  const hideCtrlTrade = branding?.hideCtrlTradeBranding === true;
  const legalEntity = branding?.legalEntity ?? branding?.tenantName ?? tenantName;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={session ? `/portal/${tenantSlug}/app` : `/portal/${tenantSlug}`}
            className="font-bold text-xl text-foreground flex items-center gap-3"
            data-testid="link-portal-home"
          >
            <img
              src={branding?.logoUrl?.trim() ? branding.logoUrl : "/assets/ctrltrade-logo.png"}
              alt={tenantName}
              className="h-8 w-auto"
            />
            <span>{tenantName}</span>
          </Link>
          {branding?.verifiedBadge ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold text-primary border border-primary/40 px-2 py-0.5 rounded"
              title="This business is CtrlTrade Verified"
              data-testid="badge-ctrltrade-verified"
            >
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          ) : null}
          {session ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground hidden sm:inline">
                {session.customer.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="font-bold text-xs"
                onClick={() => logout.mutate()}
                data-testid="button-portal-logout"
              >
                <LogOut className="h-3 w-3 mr-1" /> Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-border bg-card py-6 mt-12">
        <div className="container mx-auto px-4 text-xs text-muted-foreground text-center space-y-1">
          {branding?.supportEmail || branding?.supportPhone ? (
            <div className="font-mono">
              {branding.supportEmail ? <a href={`mailto:${branding.supportEmail}`} className="hover:underline">{branding.supportEmail}</a> : null}
              {branding.supportEmail && branding.supportPhone ? <span className="mx-2">·</span> : null}
              {branding.supportPhone ? <span>{branding.supportPhone}</span> : null}
            </div>
          ) : null}
          <div>
            {hideCtrlTrade
              ? `© ${new Date().getFullYear()} ${legalEntity}`
              : "Powered by CtrlTrade®"}
          </div>
        </div>
      </footer>
    </div>
  );
}
