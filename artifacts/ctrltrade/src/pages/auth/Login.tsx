import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { TwoFactorChallenge } from "./TwoFactorChallenge";

export function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    login.mutate({ data: { email, password } }, {
      onSuccess: async (session) => {
        if ((session as any).twoFactorRequired) {
          setShowTwoFactor(true);
          return;
        }
        toast({ title: "Login successful", description: "Welcome back." });
        // Invalidate the session cache so AppLayout gets fresh data instead of
        // stale "unauthenticated" state, which would immediately redirect back.
        await qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(220, 90%, 8%)" }}>
      <div
        className="w-full max-w-md rounded-2xl px-8 py-10 shadow-2xl"
        style={{ background: "hsl(220, 68%, 13%)", border: "1px solid hsla(220,50%,35%,0.25)" }}
      >
        {/* Logo + tagline */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/assets/ctrltrade-logo-clean.png"
            alt="CtrlTrade"
            className="h-32 w-auto object-contain"
          />
        </div>

        <p className="text-center text-sm mb-7" style={{ color: "hsl(220,25%,58%)" }}>
          Sign in to access your workspace
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "hsl(215,30%,88%)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full rounded-lg px-4 py-2.5 text-sm transition-colors outline-none"
              style={{
                background: "hsl(220,80%,9%)",
                border: "1px solid hsla(220,50%,35%,0.4)",
                color: "hsl(215,30%,93%)",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "hsl(46,98%,52%)")}
              onBlur={e => (e.currentTarget.style.borderColor = "hsla(220,50%,35%,0.4)")}
              data-testid="input-login-email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "hsl(215,30%,88%)" }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-2.5 pr-11 text-sm transition-colors outline-none"
                style={{
                  background: "hsl(220,80%,9%)",
                  border: "1px solid hsla(220,50%,35%,0.4)",
                  color: "hsl(215,30%,93%)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "hsl(46,98%,52%)")}
                onBlur={e => (e.currentTarget.style.borderColor = "hsla(220,50%,35%,0.4)")}
                data-testid="input-login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                style={{ color: "hsl(220,25%,50%)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "hsl(46,98%,52%)" }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-lg py-3 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50 mt-1"
            style={{ background: "hsl(46,98%,52%)", color: "hsl(220,90%,8%)" }}
            data-testid="button-login-submit"
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Footer links */}
        <p className="text-center text-sm mt-6" style={{ color: "hsl(220,25%,50%)" }}>
          Don't have an account?{" "}
          <Link href="/signup" className="font-semibold hover:opacity-80 transition-colors" style={{ color: "hsl(46,98%,52%)" }}>
            Sign up
          </Link>
        </p>

        <p className="text-center text-xs mt-8" style={{ color: "hsl(220,25%,38%)" }}>
          Powered by <span style={{ color: "hsl(46,98%,52%)" }}>CtrlTrade</span>
        </p>
      </div>
    </div>
  );
}
