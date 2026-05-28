import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTenantThreadMessages,
  usePostTenantThreadMessage,
  getListTenantThreadMessagesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface Props {
  subjectKind: "quote" | "job";
  subjectId: string;
}

export function TenantThread({ subjectKind, subjectId }: Props) {
  const qc = useQueryClient();
  const { data: messages } = useListTenantThreadMessages(subjectKind, subjectId);
  const [body, setBody] = useState("");
  const post = usePostTenantThreadMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: getListTenantThreadMessagesQueryKey(subjectKind, subjectId),
        });
        setBody("");
      },
    },
  });

  return (
    <Card className=" border-border shadow-sm">
      <CardHeader>
        <CardTitle className=" flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Customer messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-80 overflow-auto border border-border p-3">
          {!messages || messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm border-l-4 pl-3 ${
                  m.fromRole === "customer" ? "border-primary" : "border-muted-foreground"
                }`}
                data-testid={`tenant-message-${m.id}`}
              >
                <div className="text-xs  text-muted-foreground">
                  {m.authorLabel ?? m.fromRole} · {new Date(m.createdAt).toLocaleString("en-GB")}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            post.mutate({ subjectKind, subjectId, data: { body: body.trim() } });
          }}
          className="space-y-2"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply to the customer…"
            className="rounded-none"
            data-testid="textarea-tenant-message"
          />
          <Button
            type="submit"
            disabled={post.isPending || !body.trim()}
            className="rounded-none  font-bold"
            data-testid="button-tenant-send-message"
          >
            {post.isPending ? "Sending…" : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
