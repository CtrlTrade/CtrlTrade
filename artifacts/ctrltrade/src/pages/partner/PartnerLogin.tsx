import { useState } from "react";
import { Link, useLocation } from "wouter";
import { usePartnerLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function PartnerLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const login = usePartnerLogin({
    mutation: {
      onSuccess: () => setLocation("/"),
      onError: (err: any) => toast({ title: "Login failed", description: err.message ?? "Invalid credentials", variant: "destructive" }),
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md  border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Partner Sign In</CardTitle>
          <CardDescription>Access your CtrlTrade® referral dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); login.mutate({ data: { email, password } }); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-none" data-testid="input-partner-email" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-none" data-testid="input-partner-password" />
            </div>
            <Button type="submit" disabled={login.isPending} className="w-full rounded-none uppercase tracking-wider font-bold" data-testid="button-partner-signin">
              {login.isPending ? "Signing in…" : "Sign In"}
            </Button>
            <div className="text-sm text-muted-foreground text-center pt-2">
              New partner?{" "}
              <Link href="/signup" className="font-bold uppercase tracking-wider underline">Apply now</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
