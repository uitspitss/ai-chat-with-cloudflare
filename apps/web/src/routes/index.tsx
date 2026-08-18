import type { Thread } from "@repo/schema";
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
import { api } from "@/lib/api";
import { apiError } from "@/lib/api-error";
import { requireSession } from "@/lib/require-session";

const threadsKey = ["threads"] as const;

function ThreadListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: async (): Promise<Thread[]> => {
      const res = await api.api.threads.$get();
      if (!res.ok) throw await apiError(res, "スレッド一覧の取得に失敗した");
      return res.json();
    },
  });

  const createThread = useMutation({
    mutationFn: async (newTitle: string): Promise<Thread> => {
      const res = await api.api.threads.$post({
        json: { title: newTitle || "New thread" },
      });
      if (!res.ok) throw await apiError(res, "スレッドの作成に失敗した");
      return res.json();
    },
    onSuccess: (thread) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: threadsKey });
      navigate({ to: "/threads/$threadId", params: { threadId: thread.id } });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.threads[":id"].$delete({ param: { id } });
      if (!res.ok) throw await apiError(res, "スレッドの削除に失敗した");
    },
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
