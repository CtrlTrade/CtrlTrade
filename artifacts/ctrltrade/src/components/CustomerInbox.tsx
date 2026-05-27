import { useState } from "react";
import { Link } from "wouter";
import { useListInboxThreads, useReplyInboxThread, getListInboxThreadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Props = { customerId?: string; jobId?: string; title?: string };

export function CustomerInbox({ customerId, jobId, title = "Messages" }: Props) {
  const { data } = useListInboxThreads();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const reply = useReplyInboxThread({
    mutation: {
      onSuccess: () => {
        toast({ title: "Reply sent" });
        setReplyFor(null);
        setBody("");
        qc.invalidateQueries({ queryKey: getListInboxThreadsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Reply failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  const all = (data as any)?.threads ?? [];
  const threads = all.filter((t: any) => {
    if (jobId && t.jobId !== jobId) return false;
    if (customerId && t.customerId !== customerId) return false;
    return true;
  });

  return (
    <Card className="rounded-none border-border shadow-sm" data-testid="card-customer-inbox">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="uppercase tracking-tight">{title}</CardTitle>
        <Link href="/app/inbox" className="text-xs underline uppercase tracking-wider">Open inbox</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {threads.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
        {threads.map((t: any) => (
          <div key={t.id} className="border border-border p-3 space-y-2" data-testid={`thread-${t.id}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{t.subject ?? "(no subject)"}</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase">{t.channel}</Badge>
                {t.unreadCount > 0 && <Badge>{t.unreadCount} new</Badge>}
              </div>
            </div>
            {t.lastMessagePreview && <p className="text-xs text-muted-foreground line-clamp-2">{t.lastMessagePreview}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-none"
                onClick={() => setReplyFor(replyFor === t.id ? null : t.id)}
                data-testid={`button-reply-${t.id}`}
              >
                {replyFor === t.id ? "Cancel" : "Reply"}
              </Button>
            </div>
            {replyFor === t.id && (
              <div className="space-y-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Write a reply…"
                  data-testid={`textarea-reply-${t.id}`}
                />
                <Button
                  size="sm"
                  className="rounded-none uppercase tracking-wider"
                  disabled={!body.trim() || reply.isPending}
                  onClick={() => reply.mutate({ threadId: t.id, data: { body } })}
                  data-testid={`button-send-reply-${t.id}`}
                >
                  {reply.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
