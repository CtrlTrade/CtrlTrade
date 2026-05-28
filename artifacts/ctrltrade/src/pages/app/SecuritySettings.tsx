import { useState } from "react";
import {
  useGetSession,
  useGet2faSetup,
  useVerifyEnrol2fa,
  useDisable2fa,
  useGet2faRecoveryCodes,
  getGetSessionQueryKey,
  getGetTenantQueryKey,
  getGet2faSetupQueryKey,
  getGet2faRecoveryCodesQueryKey,
  useUpdateTenant,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, QrCode, KeyRound, Download } from "lucide-react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";

export function SecuritySettings() {
  const { data: session } = useGetSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = session?.user;
  const totpEnabled = user?.totpEnabled ?? false;
  const tenant = session?.tenant as any;
  const canEnforce = ["owner", "admin", "super_admin"].includes(user?.role ?? "");

  const [step, setStep] = useState<"idle" | "setup" | "enrol" | "disable" | "recovery">("idle");
  const [enrolCode, setEnrolCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const { refetch: fetchSetup, isFetching: fetchingSetup } = useGet2faSetup({ query: { enabled: false, queryKey: getGet2faSetupQueryKey() } });
  const { refetch: fetchRecoveryCodes, isFetching: fetchingRecoveryCodes } = useGet2faRecoveryCodes({ query: { enabled: false, queryKey: getGet2faRecoveryCodesQueryKey() } });
  const verifyEnrol = useVerifyEnrol2fa();
  const disable2fa = useDisable2fa();
  const updateTenant = useUpdateTenant();

  const handleStartSetup = async () => {
    try {
      const res = await fetchSetup();
      if (res.data) {
        setSetupSecret(res.data.secret);
        const url = await QRCode.toDataURL(res.data.otpAuthUri, { width: 200, margin: 1 });
        setQrDataUrl(url);
        setStep("setup");
      }
    } catch (err: any) {
      toast({ title: "Failed to start setup", description: err?.message, variant: "destructive" });
    }
  };

  const handleVerifyEnrol = () => {
    if (!enrolCode || enrolCode.length !== 6) {
      toast({ title: "Enter a 6-digit code", variant: "destructive" });
      return;
    }
    verifyEnrol.mutate({ data: { code: enrolCode } }, {
      onSuccess: (data) => {
        setRecoveryCodes(data.recoveryCodes);
        setStep("enrol");
        setEnrolCode("");
        setQrDataUrl("");
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        toast({ title: "2FA enabled", description: "Your account is now protected with two-factor authentication." });
      },
      onError: (err: any) => {
        toast({ title: "Verification failed", description: err?.message || "Invalid code.", variant: "destructive" });
      },
    });
  };

  const handleDisable = () => {
    if (!disableCode || disableCode.length !== 6) {
      toast({ title: "Enter a 6-digit code", variant: "destructive" });
      return;
    }
    disable2fa.mutate({ data: { code: disableCode } }, {
      onSuccess: () => {
        setStep("idle");
        setDisableCode("");
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        toast({ title: "2FA disabled", description: "Two-factor authentication has been removed from your account." });
      },
      onError: (err: any) => {
        toast({ title: "Failed to disable", description: err?.message || "Invalid code.", variant: "destructive" });
      },
    });
  };

  const handleViewRecoveryCodes = async () => {
    try {
      const res = await fetchRecoveryCodes();
      if (res.data) {
        setRecoveryCodes(res.data.recoveryCodes);
        setStep("recovery");
      }
    } catch (err: any) {
      toast({ title: "Failed to load codes", description: err?.message, variant: "destructive" });
    }
  };

  const downloadRecoveryCodes = () => {
    const text = recoveryCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ctrltrade-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRequire2faToggle = (checked: boolean) => {
    updateTenant.mutate({ data: { require2fa: checked } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey() });
        toast({
          title: checked ? "2FA enforcement enabled" : "2FA enforcement disabled",
          description: checked
            ? "All team members will be required to set up 2FA on next login."
            : "2FA is now optional for team members.",
        });
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err?.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Personal 2FA */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="">Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app (Google Authenticator, Authy, 1Password, etc).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {totpEnabled ? (
              <Badge className="bg-green-600 text-white rounded-xl uppercase text-xs">Enabled</Badge>
            ) : (
              <Badge variant="outline" className="rounded-xl uppercase text-xs text-muted-foreground">Not enabled</Badge>
            )}
          </div>

          {!totpEnabled && step === "idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan a QR code with your authenticator app to enable 2FA.
              </p>
              <Button
                onClick={handleStartSetup}
                disabled={fetchingSetup}
                className="rounded-xl uppercase font-bold tracking-wider"
                data-testid="button-2fa-enable"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {fetchingSetup ? "Loading..." : "Enable two-factor authentication"}
              </Button>
            </div>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">1. Scan this QR code with your authenticator app:</p>
                {qrDataUrl && (
                  <div className="border border-border p-4 inline-block bg-white">
                    <img src={qrDataUrl} alt="2FA QR code" width={200} height={200} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Or enter this secret manually:{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 break-all">{setupSecret}</code>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">2. Enter the 6-digit code shown in your app:</p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    value={enrolCode}
                    onChange={(e) => setEnrolCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    className="rounded-xl font-mono text-center text-xl tracking-widest w-40"
                    data-testid="input-2fa-enrol-code"
                  />
                  <Button
                    onClick={handleVerifyEnrol}
                    disabled={verifyEnrol.isPending || enrolCode.length !== 6}
                    className="rounded-xl uppercase font-bold tracking-wider"
                    data-testid="button-2fa-confirm-enrol"
                  >
                    {verifyEnrol.isPending ? "Verifying..." : "Confirm"}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => { setStep("idle"); setQrDataUrl(""); setSetupSecret(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "enrol" && recoveryCodes.length > 0 && (
            <div className="space-y-4">
              <div className="border border-yellow-400 bg-yellow-50 dark:bg-yellow-950 p-4 space-y-2">
                <p className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                  Save your recovery codes now — they won't be shown again
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Each code can only be used once. Store them somewhere safe.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <div key={c} className="border border-border px-3 py-2 text-center bg-muted">{c}</div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="rounded-xl uppercase text-xs font-bold" onClick={downloadRecoveryCodes}>
                  <Download className="h-4 w-4 mr-2" /> Download codes
                </Button>
                <Button className="rounded-xl uppercase text-xs font-bold" onClick={() => { setStep("idle"); setRecoveryCodes([]); }} data-testid="button-2fa-done">
                  Done
                </Button>
              </div>
            </div>
          )}

          {totpEnabled && step === "idle" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-xl uppercase text-xs font-bold"
                onClick={handleViewRecoveryCodes}
                disabled={fetchingRecoveryCodes}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {fetchingRecoveryCodes ? "Loading..." : "View recovery codes"}
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl uppercase text-xs font-bold"
                onClick={() => setStep("disable")}
                data-testid="button-2fa-disable"
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Disable 2FA
              </Button>
            </div>
          )}

          {step === "disable" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter your current authenticator code to confirm disabling 2FA:</p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  className="rounded-xl font-mono text-center text-xl tracking-widest w-40"
                  data-testid="input-2fa-disable-code"
                />
                <Button
                  variant="destructive"
                  onClick={handleDisable}
                  disabled={disable2fa.isPending || disableCode.length !== 6}
                  className="rounded-xl uppercase font-bold tracking-wider"
                  data-testid="button-2fa-confirm-disable"
                >
                  {disable2fa.isPending ? "Disabling..." : "Confirm disable"}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setStep("idle"); setDisableCode(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === "recovery" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Your remaining recovery codes (each can only be used once):</p>
              {recoveryCodes.length === 0 ? (
                <p className="text-sm text-destructive">No recovery codes remaining. Disable and re-enable 2FA to generate new ones.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {recoveryCodes.map((c) => (
                    <div key={c} className="border border-border px-3 py-2 text-center bg-muted">{c}</div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {recoveryCodes.length > 0 && (
                  <Button variant="outline" className="rounded-xl uppercase text-xs font-bold" onClick={downloadRecoveryCodes}>
                    <Download className="h-4 w-4 mr-2" /> Download codes
                  </Button>
                )}
                <Button className="rounded-xl uppercase text-xs font-bold" onClick={() => { setStep("idle"); setRecoveryCodes([]); }}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant-level 2FA enforcement (owner/admin only) */}
      {canEnforce && tenant && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="">Team 2FA Policy</CardTitle>
            <CardDescription>
              Require all team members to enrol in two-factor authentication. Members without 2FA will be redirected to set it up on next login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Switch
                id="require-2fa-toggle"
                checked={tenant?.require2fa ?? false}
                onCheckedChange={handleRequire2faToggle}
                disabled={updateTenant.isPending}
                data-testid="switch-require-2fa"
              />
              <Label htmlFor="require-2fa-toggle" className="text-sm font-medium cursor-pointer">
                Require 2FA for all team members
              </Label>
            </div>
            {tenant?.require2fa && (
              <p className="text-xs text-muted-foreground mt-3">
                Team members without 2FA will be prompted to set it up on their next login.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
