import { useState } from "react";
import { useParams } from "wouter";
import { useRequestPortalMagicLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PortalLogin() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const mut = useRequestPortalMagicLink({
    mutation: {
      onSuccess: (data) => {
        setSubmitted(true);
        setDevLink(data.devLink ?? null);
      },
    },
  });

  return (
    <div className="max-w-md mx-auto">
      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="">Customer sign-in</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm">
                If <span className="font-mono">{email}</span> matches a customer on file, a
                sign-in link has been sent. Check your inbox.
              </p>
              {devLink ? (
                <div className="border border-dashed border-border p-3 text-xs space-y-2">
                  <p className="font-bold text-muted-foreground">
                    Dev preview link
                  </p>
                  <a
                    href={devLink}
                    className="text-primary underline break-all"
                    data-testid="link-dev-magic"
                  >
                    {devLink}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mut.mutate({ tenantSlug, data: { email: email.trim().toLowerCase() } });
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Enter the email address your supplier has on file. We'll send a one-time link to
                view your quotes, invoices and jobs.
              </p>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-portal-email"
                />
              </div>
              <Button
                type="submit"
                disabled={mut.isPending}
                className="rounded-xl font-bold w-full"
                data-testid="button-portal-magic-link"
              >
                {mut.isPending ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
