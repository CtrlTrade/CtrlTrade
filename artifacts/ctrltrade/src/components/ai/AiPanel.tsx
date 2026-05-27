import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Sparkles, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AiPanelProps {
  title: string;
  description?: string;
  buttonLabel?: string;
  prompt: Record<string, unknown>;
  endpoint: string;
  resultKey: string;
  badgeLabel?: string;
}

export function AiPanel({ title, description, buttonLabel = "Ask AI", prompt, endpoint, resultKey, badgeLabel }: AiPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setExpanded(true);
    try {
      const base = import.meta.env.BASE_URL ?? "/";
      const url = `${base.replace(/\/$/, "")}api/${endpoint.replace(/^\//, "")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI request failed");
      setResult(json[resultKey] ?? JSON.stringify(json, null, 2));
    } catch (err: any) {
      toast({ title: "AI error", description: err.message, variant: "destructive" });
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="rounded-none border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm uppercase tracking-wider font-bold">{title}</CardTitle>
            {badgeLabel && <Badge variant="outline" className="rounded-none text-[10px] h-4 px-1 border-primary/30 text-primary">{badgeLabel}</Badge>}
          </div>
          {result && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && (
          <Button
            size="sm"
            onClick={run}
            disabled={loading}
            className="rounded-none gap-2 uppercase text-xs font-bold tracking-wider"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Thinking..." : buttonLabel}
          </Button>
        )}
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        )}
        {result && expanded && (
          <div className="relative">
            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 border border-border p-3 pr-10">{result}</div>
            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={copyResult}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
        {result && (
          <Button size="sm" variant="outline" onClick={run} disabled={loading} className="rounded-none gap-2 text-xs">
            <Sparkles className="h-3 w-3" /> Regenerate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
