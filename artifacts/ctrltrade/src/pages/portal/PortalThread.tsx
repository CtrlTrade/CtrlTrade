import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPortalThreadMessages,
  usePostPortalThreadMessage,
  getListPortalThreadMessagesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  subjectKind: "quote" | "job";
  subjectId: string;
}

export function PortalThread({ subjectKind, subjectId }: Props) {
  const qc = useQueryClient();
  const { data: messages } = useListPortalThreadMessages(subjectKind, subjectId);
  const [body, setBody] = useState("");
  const post = usePostPortalThreadMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: getListPortalThreadMessagesQueryKey(subjectKind, subjectId),
        });
        setBody("");
      },
    },
  });

  return (
    <div className="space-y-4">
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
              data-testid={`portal-message-${m.id}`}
            >
              <div className="text-xs text-muted-foreground">
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
          placeholder="Send a message…"
          className="rounded-xl"
          data-testid="textarea-portal-message"
        />
        <Button
          type="submit"
          disabled={post.isPending || !body.trim()}
          className="rounded-xl font-bold"
          data-testid="button-portal-send-message"
        >
          {post.isPending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
