import { useGetPosDownloads } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Laptop, Monitor } from "lucide-react";

export function PosDownloads() {
  const { data, isLoading } = useGetPosDownloads();

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Download CtrlTradePos®
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-10 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const windowsUrl = data?.windowsUrl ?? null;
  const macosUrl = data?.macosUrl ?? null;

  if (!windowsUrl && !macosUrl) {
    return null;
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Download CtrlTradePos®
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {windowsUrl && (
            <a href={windowsUrl} target="_blank" rel="noopener noreferrer" data-testid="download-windows">
              <Button variant="outline" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Download for Windows
              </Button>
            </a>
          )}
          {macosUrl && (
            <a href={macosUrl} target="_blank" rel="noopener noreferrer" data-testid="download-macos">
              <Button variant="outline" className="flex items-center gap-2">
                <Laptop className="h-4 w-4" />
                Download for macOS
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
