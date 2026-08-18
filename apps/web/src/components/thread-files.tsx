import type { FileMeta } from "@repo/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, PaperclipIcon } from "lucide-react";
import { useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { apiError } from "@/lib/api-error";

/**
 * ファイル選択 → Hono にアップロード URL を要求 → その URL に PUT。
 * 本体は API サーバー経由で R2 に入る（presigned URL 方式に差し替えても
 * クライアント側の手順は変わらない）。
 */
export function ThreadFiles({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesKey = ["files", threadId] as const;

  const files = useQuery({
    queryKey: filesKey,
    queryFn: async (): Promise<FileMeta[]> => {
      const res = await api.api.files.$get({ query: { threadId } });
      if (!res.ok) throw await apiError(res, "添付ファイルの取得に失敗した");
      return res.json();
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const urlRes = await api.api.files["upload-url"].$post({
        json: {
          threadId,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      });
      if (!urlRes.ok) throw await apiError(urlRes, "アップロード URL の発行に失敗した");
      const { uploadUrl } = await urlRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        credentials: "include",
        headers: { "content-type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw await apiError(putRes, "アップロードに失敗した");
    },
    onSuccess: () => {
      if (inputRef.current) inputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: filesKey });
    },
  });

  return (
    <div className="flex flex-col gap-2 border-b p-4">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          id="thread-file"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PaperclipIcon data-icon="inline-start" />
          )}
          ファイルを添付
        </Button>
      </div>

      {upload.error && (
        <Alert variant="destructive">
          <AlertTitle>添付できなかった</AlertTitle>
          <AlertDescription>{upload.error.message}</AlertDescription>
        </Alert>
      )}

      {files.data && files.data.length > 0 && (
        <AttachmentGroup>
          {files.data.map((file) => (
            <Attachment key={file.id} state="done" size="sm">
              <AttachmentMedia variant="icon">
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>
                  <a href={`/api/files/${file.id}/content`} target="_blank" rel="noreferrer">
                    {file.name}
                  </a>
                </AttachmentTitle>
              </AttachmentContent>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
    </div>
  );
}
