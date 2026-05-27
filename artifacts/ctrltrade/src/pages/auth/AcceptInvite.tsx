import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetInvitation, useAcceptInvitation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

function useQueryToken(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function AcceptInvite() {
  const token = useQueryToken();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const { data, isLoading, error } = useGetInvitation(token, { query: { enabled: !!token } as any });
  const accept = useAcceptInvitation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Welcome aboard" });
        setLocation("~/app");
      },
      onError: (e: any) => toast({ title: "Could not accept", description: e?.message, variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (data?.email && !name) setName(data.email.split("@")[0] ?? "");
  }, [data?.email]);

  if (!token) return <div className="p-8">Missing invitation token.</div>;
  if (isLoading) return <div className="p-8">Loading invitation…</div>;
  if (error || !data) return <div className="p-8">This invitation is invalid or has expired.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md  border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tighter">Join {data.tenantName}</CardTitle>
          <CardDescription>You've been invited as <strong>{data.role}</strong> ({data.seatType} seat) on CtrlTrade®.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              accept.mutate({
                token,
                data: data.requiresPassword ? { name, password } : {},
              });
            }}
          >
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={data.email} disabled className="rounded-none" />
            </div>
            {data.requiresPassword && (
              <>
                <div className="space-y-1">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-none" data-testid="input-accept-name" />
                </div>
                <div className="space-y-1">
                  <Label>Password (min 8 chars)</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="rounded-none" data-testid="input-accept-password" />
                </div>
              </>
            )}
            <Button type="submit" disabled={accept.isPending} className="w-full uppercase font-bold tracking-wider" data-testid="button-accept-invite">
              {accept.isPending ? "Joining..." : "Accept & join"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
