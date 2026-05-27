import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import { TwoFactorChallenge } from "./TwoFactorChallenge";

export function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    login.mutate({ data: { email, password } }, {
      onSuccess: (session) => {
        if ((session as any).twoFactorRequired) {
          setShowTwoFactor(true);
          return;
        }
        toast({ title: "Login successful", description: "Welcome back." });
        if ((session as any).twoFactorSetupRequired) {
          setLocation("/app/settings?tab=security&setup=required");
          return;
        }
        if (session.user?.isSuperAdmin) {
          setLocation("/admin");
        } else {
          setLocation("/app");
        }
      },
      onError: (err: any) => {
        toast({ title: "Login failed", description: err?.message || "Invalid credentials.", variant: "destructive" });
      }
    });
  };

  const handle2faSuccess = (session: { user: { isSuperAdmin: boolean } }) => {
    toast({ title: "Login successful", description: "Welcome back." });
    if (session.user.isSuperAdmin) {
      setLocation("/admin");
    } else {
      setLocation("/app");
    }
  };

  if (showTwoFactor) {
    return (
      <TwoFactorChallenge
        onSuccess={handle2faSuccess}
        onCancel={() => setShowTwoFactor(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md  border-border shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold uppercase tracking-tighter">Login</CardTitle>
          <CardDescription>Enter your credentials to access your CTRLTRADE® command center.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="rounded-none"
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="rounded-none"
                data-testid="input-login-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full font-bold uppercase tracking-wider mt-4" 
              disabled={login.isPending}
              data-testid="button-login-submit"
            >
              {login.isPending ? "Logging in..." : <><LogIn className="mr-2 h-4 w-4"/> Access System</>}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Don't have an account? <Link href="/signup" className="text-primary font-medium hover:underline">Start your free trial</Link>
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/forgot-password" className="text-primary font-medium hover:underline">Forgot password?</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
