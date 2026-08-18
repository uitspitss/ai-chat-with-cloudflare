import { useAgentChat } from "@cloudflare/ai-chat/react";
import { createFileRoute } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import { SendIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { MessageParts } from "@/components/message-parts";
import { ThreadFiles } from "@/components/thread-files";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { requireSession } from "@/lib/require-session";

function ChatPage() {
  const { threadId } = Route.useParams();
  const [input, setInput] = useState("");

  // agent-per-thread: インスタンス名を threadId にすることで
  // スレッドごとに独立した Durable Object（＝独立した会話履歴）になる。
  const agent = useAgent({ agent: "chat-agent", name: threadId });
  const { messages, sendMessage, status, clearHistory } = useAgentChat({ agent });

  const busy = status === "streaming" || status === "submitted";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ThreadFiles threadId={threadId} />

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-4">
              {messages.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SparklesIcon />
                    </EmptyMedia>
                    <EmptyTitle>まだメッセージがない</EmptyTitle>
                    <EmptyDescription>
                      メッセージを送ると会話が始まる。添付ファイルの内容も聞ける。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {messages.map((message) => {
                const align = message.role === "user" ? "end" : "start";
                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <Message align={align}>
                      <MessageContent>
                        <MessageHeader>
                          {message.role === "user" ? "You" : "Assistant"}
                        </MessageHeader>
                        <MessageParts message={message} align={align} />
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {status === "submitted" && (
                <Message align="start">
                  <MessageContent>
                    <Spinner />
                  </MessageContent>
                </Message>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className="flex gap-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <Input
          placeholder="メッセージを入力"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          <SendIcon data-icon="inline-start" />
          送信
        </Button>
        <Button type="button" variant="outline" onClick={clearHistory}>
          履歴消去
        </Button>
      </form>
    </div>
  );
}

export const Route = createFileRoute("/threads/$threadId")({
  beforeLoad: requireSession,
  component: ChatPage,
});
