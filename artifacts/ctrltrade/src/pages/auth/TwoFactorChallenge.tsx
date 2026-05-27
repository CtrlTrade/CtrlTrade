import { useState } from "react";
import { useSubmit2faChallenge } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

interface Props {
  onSuccess: (session: { user: { isSuperAdmin: boolean } }) => void;
  onCancel: () => void;
}

export function TwoFactorChallenge({ onSuccess, onCancel }: Props) {
  const { toast } = useToast();
  const submit = useSubmit2faChallenge();
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = useRecovery ? { recoveryCode } : { code };
    submit.mutate({ data }, {
      onSuccess: (session) => {
        toast({ title: "Verified", description: "Two-factor authentication successful." });
        onSuccess(session as any);
      },
      onError: (err: any) => {
        toast({ title: "Verification failed", description: err?.message || "Invalid code.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold uppercase tracking-tighter">Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            {useRecovery
              ? "Enter one of your recovery codes to access your account."
              : "Enter the 6-digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {useRecovery ? (
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="XXXXX-XXXXX"
                  required
                  className="rounded-none font-mono"
                  data-testid="input-2fa-recovery"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totp-code">Authenticator Code</Label>
                <Input
                  id="totp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  required
                  className="rounded-none font-mono text-center text-2xl tracking-widest"
                  data-testid="input-2fa-code"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full font-bold uppercase tracking-wider"
              disabled={submit.isPending}
              data-testid="button-2fa-verify"
            >
              {submit.isPending ? "Verifying..." : "Verify"}
            </Button>
            <div className="flex justify-between text-sm text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground underline"
                onClick={() => { setUseRecovery(!useRecovery); setCode(""); setRecoveryCode(""); }}
              >
                {useRecovery ? "Use authenticator app instead" : "Use a recovery code instead"}
              </button>
              <button
                type="button"
                className="hover:text-foreground underline"
                onClick={onCancel}
              >
                Back to login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
