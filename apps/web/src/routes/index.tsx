import { threadsKey } from "@repo/app-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessagesSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { appApi } from "@/lib/api";
import { requireSession } from "@/lib/require-session";

function ThreadListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: () => appApi.listThreads(),
  });

  const createThread = useMutation({
    mutationFn: (newTitle: string) => appApi.createThread(newTitle || "New thread"),
    onSuccess: (thread) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: threadsKey });
      navigate({ to: "/threads/$threadId", params: { threadId: thread.id } });
    },
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => appApi.deleteThread(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });

  const failure = threads.error ?? createThread.error ?? deleteThread.error;

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          createThread.mutate(title);
        }}
      >
        <Input
          placeholder="新しいスレッドのタイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={createThread.isPending}>
          {createThread.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          作成
        </Button>
      </form>

      {failure && (
        <Alert variant="destructive">
          <AlertTitle>操作に失敗した</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      )}

      {threads.isPending && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {threads.data?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>スレッドがまだない</EmptyTitle>
            <EmptyDescription>上のフォームからタイトルを入れて作成する。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {threads.data && threads.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {threads.data.map((thread) => (
            <li key={thread.id}>
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>
                    <Link to="/threads/$threadId" params={{ threadId: thread.id }}>
                      {thread.title}
                    </Link>
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${thread.title} を削除`}
                    onClick={() => deleteThread.mutate(thread.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export const Route = createFileRoute("/")({
  beforeLoad: requireSession,
  component: ThreadListPage,
});
