import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useVerifyPortalMagicLink } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";

export function PortalVerify() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const mut = useVerifyPortalMagicLink({
    mutation: {
      onSuccess: () => {
        setLocation(`/portal/${tenantSlug}/app`);
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }
    mut.mutate({ tenantSlug, data: { token } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto">
      <Card className=" border-border shadow-sm">
        <CardContent className="py-12 text-center text-sm">
          {error ? (
            <div className="space-y-2">
              <p className="text-destructive font-bold uppercase tracking-tighter">
                Sign-in failed
              </p>
              <p className="text-muted-foreground">{error}</p>
              <a
                href={`/portal/${tenantSlug}`}
                className="text-primary underline"
                data-testid="link-portal-retry"
              >
                Request a new link
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">Signing you in…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
