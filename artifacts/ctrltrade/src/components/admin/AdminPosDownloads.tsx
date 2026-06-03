import { useState, useEffect, useRef } from "react";
import {
  useAdminGetPosDownloads,
  useAdminUpdatePosDownloads,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Upload, Loader2 } from "lucide-react";

const ACCEPT = ".exe,.dmg,application/octet-stream,application/x-msdownload,application/x-apple-diskimage";

interface UploadState {
  isUploading: boolean;
  progress: number;
}

async function uploadInstaller(
  file: File,
  platform: "windows" | "macos",
): Promise<{ windowsUrl: string | null; macosUrl: string | null }> {
  const urlRes = await fetch("/api/v1/admin/pos-downloads/request-installer-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
  }
  const { uploadUrl, objectPath } = await urlRes.json() as { uploadUrl: string; objectPath: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) {
    throw new Error("File upload to storage failed");
  }

  const confirmRes = await fetch("/api/v1/admin/pos-downloads/confirm-installer-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, objectPath }),
  });
  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to confirm upload");
  }
  return confirmRes.json();
}

export function AdminPosDownloads() {
  const { data, isLoading } = useAdminGetPosDownloads();
  const update = useAdminUpdatePosDownloads();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [windowsUrl, setWindowsUrl] = useState("");
  const [macosUrl, setMacosUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [windowsUpload, setWindowsUpload] = useState<UploadState>({ isUploading: false, progress: 0 });
  const [macosUpload, setMacosUpload] = useState<UploadState>({ isUploading: false, progress: 0 });

  const windowsInputRef = useRef<HTMLInputElement>(null);
  const macosInputRef = useRef<HTMLInputElement>(null);

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

  const isStorageUrl = (v: string) => v.startsWith("/api/storage/");

  const windowsError = windowsUrl && !isValidHttpsOrEmpty(windowsUrl) && !isStorageUrl(windowsUrl)
    ? "Must be a valid https:// URL"
    : null;
  const macosError = macosUrl && !isValidHttpsOrEmpty(macosUrl) && !isStorageUrl(macosUrl)
    ? "Must be a valid https:// URL"
    : null;
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

  const handleFileUpload = async (file: File, platform: "windows" | "macos") => {
    const setUpload = platform === "windows" ? setWindowsUpload : setMacosUpload;
    setUpload({ isUploading: true, progress: 10 });
    setSaved(false);
    try {
      setUpload({ isUploading: true, progress: 40 });
      const result = await uploadInstaller(file, platform);
      setUpload({ isUploading: false, progress: 100 });

      if (platform === "windows" && result.windowsUrl) {
        setWindowsUrl(result.windowsUrl);
      } else if (platform === "macos" && result.macosUrl) {
        setMacosUrl(result.macosUrl);
      }

      await queryClient.invalidateQueries({ queryKey: ["/v1/admin/pos-downloads"] });

      toast({ title: `${platform === "windows" ? "Windows" : "macOS"} installer uploaded and saved` });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setUpload({ isUploading: false, progress: 0 });
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const isAnyUploading = windowsUpload.isUploading || macosUpload.isUploading;

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
              <div className="flex gap-1.5">
                <Input
                  value={windowsUrl}
                  onChange={(e) => { setWindowsUrl(e.target.value); setSaved(false); }}
                  placeholder="https://... or upload a file"
                  data-testid="input-windows-url"
                  className={`font-mono text-xs h-8 bg-card border-border flex-1 ${windowsError ? "border-red-500" : ""}`}
                />
                <input
                  ref={windowsInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "windows");
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => windowsInputRef.current?.click()}
                  disabled={isAnyUploading}
                  data-testid="button-upload-windows"
                  className="h-8 px-2 border-border text-muted-foreground hover:text-foreground"
                  title="Upload .exe file"
                >
                  {windowsUpload.isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              {windowsError && (
                <p className="text-[10px] text-red-500">{windowsError}</p>
              )}
              {windowsUpload.isUploading && (
                <p className="text-[10px] text-muted-foreground">Uploading…</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                macOS (.dmg) URL
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={macosUrl}
                  onChange={(e) => { setMacosUrl(e.target.value); setSaved(false); }}
                  placeholder="https://... or upload a file"
                  data-testid="input-macos-url"
                  className={`font-mono text-xs h-8 bg-card border-border flex-1 ${macosError ? "border-red-500" : ""}`}
                />
                <input
                  ref={macosInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "macos");
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => macosInputRef.current?.click()}
                  disabled={isAnyUploading}
                  data-testid="button-upload-macos"
                  className="h-8 px-2 border-border text-muted-foreground hover:text-foreground"
                  title="Upload .dmg file"
                >
                  {macosUpload.isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              {macosError && (
                <p className="text-[10px] text-red-500">{macosError}</p>
              )}
              {macosUpload.isUploading && (
                <p className="text-[10px] text-muted-foreground">Uploading…</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={update.isPending || hasError || isAnyUploading}
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
