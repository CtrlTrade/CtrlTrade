import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ObjectUploader, useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, Trash2, Upload, FileIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileMeta {
  id: string;
  url: string;
  kind: string;
  name?: string | null;
  label?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedByLabel?: string | null;
  createdAt: string;
}

interface FileAttachmentsProps {
  parentKind: string;
  parentId: string;
  kind: string;
  title?: string;
  accept?: string;
  maxFileSize?: number;
}

function listKey(parentKind: string, parentId: string) {
  return ["files", parentKind, parentId];
}

export function FileAttachments({
  parentKind,
  parentId,
  kind,
  title = "Attachments",
  maxFileSize = 25 * 1024 * 1024,
}: FileAttachmentsProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { getUploadParameters } = useUpload();

  const { data, isLoading } = useQuery<FileMeta[]>({
    queryKey: listKey(parentKind, parentId),
    queryFn: async () => {
      const r = await fetch(
        `/api/v1/files?parentKind=${encodeURIComponent(parentKind)}&parentId=${encodeURIComponent(parentId)}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Failed to load attachments");
      return r.json();
    },
    enabled: !!parentId,
  });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/v1/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to save file metadata");
      return r.json() as Promise<FileMeta>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(parentKind, parentId) }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/v1/files/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(parentKind, parentId) }),
  });

  return (
    <Card className="rounded-none border-border shadow-sm">
      <CardHeader>
        <CardTitle className="uppercase tracking-tight flex items-center gap-2">
          <Paperclip className="h-5 w-5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ObjectUploader
          maxNumberOfFiles={10}
          maxFileSize={maxFileSize}
          onGetUploadParameters={getUploadParameters}
          onComplete={async (result) => {
            for (const f of result.successful ?? []) {
              const uploadURL = (f as { uploadURL?: string }).uploadURL;
              if (!uploadURL) continue;
              try {
                await create.mutateAsync({
                  url: uploadURL,
                  kind,
                  parentKind,
                  parentId,
                  name: f.name ?? null,
                  mimeType: f.type ?? null,
                  sizeBytes: f.size ?? null,
                });
              } catch (e) {
                toast({
                  title: "Upload failed",
                  description: (e as Error).message,
                  variant: "destructive",
                });
              }
            }
            if ((result.successful ?? []).length > 0) {
              toast({ title: "Uploaded", description: `${result.successful?.length ?? 0} file(s)` });
            }
          }}
          buttonClassName="inline-flex items-center justify-center gap-2 rounded-none uppercase tracking-wider font-bold bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Upload files
        </ObjectUploader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {data.map((f) => (
              <li key={f.id} className="flex items-center gap-3 p-3" data-testid={`file-${f.id}`}>
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {f.name ?? f.url.split("/").pop()}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {f.uploadedByLabel ?? "—"} · {new Date(f.createdAt).toLocaleString()}
                    {f.sizeBytes ? ` · ${(f.sizeBytes / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none"
                  onClick={() => remove.mutate(f.id)}
                  disabled={remove.isPending}
                  data-testid={`button-delete-file-${f.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
