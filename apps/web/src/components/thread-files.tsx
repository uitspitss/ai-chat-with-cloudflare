import { filesKey } from "@repo/app-api";
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
import { appApi } from "@/lib/api";

/** ファイル選択 → アップロード。手順は `@repo/app-api` が持つ（mobile と共通）。 */
export function ThreadFiles({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const key = filesKey(threadId);

  const files = useQuery({
    queryKey: key,
    queryFn: () => appApi.listFiles(threadId),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      appApi.uploadFile({
        threadId,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
        body: file,
      }),
    onSuccess: () => {
      if (inputRef.current) inputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: key });
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
                  <a href={appApi.fileContentUrl(file.id)} target="_blank" rel="noreferrer">
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
