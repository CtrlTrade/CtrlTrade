import { useState, useEffect } from "react";
import {
  useAdminGetPosDownloads,
  useAdminUpdatePosDownloads,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2 } from "lucide-react";

export function AdminPosDownloads() {
  const { data, isLoading } = useAdminGetPosDownloads();
  const update = useAdminUpdatePosDownloads();
  const { toast } = useToast();

  const [windowsUrl, setWindowsUrl] = useState("");
  const [macosUrl, setMacosUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setWindowsUrl(data.windowsUrl ?? "");
      setMacosUrl(data.macosUrl ?? "");
    }
  }, [data]);

  const isValidHttpsOrEmpty = (v: string) => {
    if (v === "") return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const windowsError = windowsUrl && !isValidHttpsOrEmpty(windowsUrl) ? "Must be a valid https:// URL" : null;
  const macosError = macosUrl && !isValidHttpsOrEmpty(macosUrl) ? "Must be a valid https:// URL" : null;
  const hasError = Boolean(windowsError || macosError);

  const handleSave = () => {
    setSaved(false);
    update.mutate(
      {
        data: {
          windowsUrl: windowsUrl || null,
          macosUrl: macosUrl || null,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          toast({ title: "POS download URLs saved" });
          setTimeout(() => setSaved(false), 3000);
        },
        onError: () => {
          toast({ title: "Failed to save URLs", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Card className="rounded-xl border-border bg-black shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground text-sm flex items-center gap-2">
          <Download className="h-4 w-4 text-red-500" /> POS Download Links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-16 animate-pulse bg-card rounded" />
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                Windows (.exe) URL
              </label>
              <Input
                value={windowsUrl}
                onChange={(e) => { setWindowsUrl(e.target.value); setSaved(false); }}
                placeholder="https://..."
                data-testid="input-windows-url"
                className={`font-mono text-xs h-8 bg-card border-border ${windowsError ? "border-red-500" : ""}`}
              />
              {windowsError && (
                <p className="text-[10px] text-red-500">{windowsError}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                macOS (.dmg) URL
              </label>
              <Input
                value={macosUrl}
                onChange={(e) => { setMacosUrl(e.target.value); setSaved(false); }}
                placeholder="https://..."
                data-testid="input-macos-url"
                className={`font-mono text-xs h-8 bg-card border-border ${macosError ? "border-red-500" : ""}`}
              />
              {macosError && (
                <p className="text-[10px] text-red-500">{macosError}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={update.isPending || hasError}
                data-testid="button-save-pos-downloads"
                className="rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold text-xs"
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
