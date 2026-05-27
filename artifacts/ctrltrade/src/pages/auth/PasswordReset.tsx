import { useState } from "react";
import { useLocation } from "wouter";
import { useRequestPasswordReset, useCompletePasswordReset } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const req = useRequestPasswordReset({ mutation: { onSuccess: () => setSent(true) } });
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md  border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tighter">Reset your password</CardTitle>
          <CardDescription>Enter your email and we'll send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm">If that email is registered, a reset link is on its way.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); req.mutate({ data: { email } }); }}
            >
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="rounded-none" data-testid="input-forgot-email" />
              </div>
              <Button type="submit" disabled={req.isPending} className="w-full uppercase font-bold tracking-wider" data-testid="button-forgot-submit">
                {req.isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") ?? "" : "";
  const [password, setPassword] = useState("");
  const complete = useCompletePasswordReset({
    mutation: {
      onSuccess: () => { toast({ title: "Password updated" }); setLocation("~/login"); },
      onError: (e: any) => toast({ title: "Could not reset", description: e?.message, variant: "destructive" }),
    },
  });
  if (!token) return <div className="p-8">Missing reset token.</div>;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md  border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tighter">Set new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); complete.mutate({ data: { token, password } }); }}
          >
            <div className="space-y-1">
              <Label>New password (min 8 chars)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="rounded-none" data-testid="input-reset-password" />
            </div>
            <Button type="submit" disabled={complete.isPending} className="w-full uppercase font-bold tracking-wider" data-testid="button-reset-submit">
              {complete.isPending ? "Saving..." : "Set password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
