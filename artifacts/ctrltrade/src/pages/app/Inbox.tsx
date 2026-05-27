import { useEffect, useState } from "react";
import {
  useListInboxThreads,
  useListInboxMessages,
  useMarkInboxThreadRead,
  useReplyInboxThread,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Phone, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="h-4 w-4" />;
  if (channel === "sms") return <Phone className="h-4 w-4" />;
  if (channel === "whatsapp") return <MessageSquare className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
}

function timeShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
}

export function AppInbox() {
  const { data, isLoading } = useListInboxThreads();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && data?.threads && data.threads.length > 0) {
      setSelectedId(data.threads[0].id);
    }
  }, [data, selectedId]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Inbox</h1>
        <p className="text-sm text-muted-foreground">All customer conversations across email, SMS &amp; WhatsApp.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-[600px]">
        <Card className="rounded-none border-border">
          <CardHeader className="py-3">
            <CardTitle className="text-sm uppercase tracking-wider">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !data?.threads.length ? (
              <div className="p-6 text-sm text-muted-foreground">No conversations yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.threads.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`p-3 cursor-pointer hover:bg-muted/40 ${active ? "bg-muted/60" : ""}`}
                      data-testid={`inbox-thread-${t.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChannelIcon channel={t.channel} />
                          <span className="font-bold text-sm truncate uppercase tracking-tight">
                            {t.customerName ?? t.customerEmail ?? t.customerPhone ?? "(unknown)"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeShort(t.lastMessageAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {t.lastDirection === "in" ? "↓ " : t.lastDirection === "out" ? "↑ " : ""}
                          {t.lastMessagePreview ?? "—"}
                        </p>
                        {t.unreadCount > 0 && (
                          <Badge className="rounded-none bg-primary text-primary-foreground text-[10px]" data-testid={`inbox-unread-${t.id}`}>
                            {t.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <ThreadView threadId={selectedId} />
      </div>
    </div>
  );
}

function ThreadView({ threadId }: { threadId: string | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListInboxMessages(threadId ?? "", {
    query: { enabled: Boolean(threadId) } as any,
  });
  const markRead = useMarkInboxThreadRead();
  const reply = useReplyInboxThread();
  const [body, setBody] = useState("");

  useEffect(() => {
    if (threadId) {
      markRead.mutate({ threadId }, {
        onSuccess: () => qc.invalidateQueries(),
      });
    }
    setBody("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  if (!threadId) {
    return (
      <Card className="rounded-none border-border flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a conversation</p>
      </Card>
    );
  }

  const submit = () => {
    if (!body.trim() || !threadId) return;
    reply.mutate(
      { threadId, data: { body } },
      {
        onSuccess: () => {
          toast({ title: "Reply sent" });
          setBody("");
          qc.invalidateQueries();
        },
        onError: (err: any) => toast({ title: "Send failed", description: err?.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="rounded-none border-border flex flex-col">
      <CardHeader className="py-3 border-b border-border">
        <CardTitle className="text-sm uppercase tracking-wider">Conversation</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[480px]">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-16 w-1/2 ml-auto" />
          </div>
        ) : !data?.messages.length ? (
          <div className="p-6 text-sm text-muted-foreground">No messages.</div>
        ) : (
          <ul className="p-4 space-y-3">
            {data.messages.map((m) => (
              <li
                key={m.id}
                className={`max-w-[80%] p-3 border border-border text-sm ${
                  m.direction === "out" ? "ml-auto bg-primary/5" : "bg-muted/40"
                }`}
                data-testid={`inbox-msg-${m.id}`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1 gap-3">
                  <span className="flex items-center gap-1">
                    <ChannelIcon channel={m.channel} />
                    {m.channel} · {m.direction === "out" ? "sent" : "received"} · {m.authorLabel ?? m.fromAddr ?? ""}
                  </span>
                  <span>{timeShort(m.createdAt)}</span>
                </div>
                {m.subject && <div className="font-bold mb-1">{m.subject}</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <div className="p-3 border-t border-border space-y-2 bg-muted/20">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a reply…"
          className="rounded-none"
          data-testid="inbox-reply-body"
        />
        <div className="flex justify-end">
          <Button
            onClick={submit}
            disabled={!body.trim() || reply.isPending}
            className="rounded-none uppercase tracking-wider font-bold gap-2"
            data-testid="inbox-reply-send"
          >
            <Send className="h-4 w-4" /> {reply.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
