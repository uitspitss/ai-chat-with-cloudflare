import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { MessageParts } from "@/components/message-parts";
import { ThreadFiles } from "@/components/thread-files";
import { currentCookie } from "@/lib/auth";
import { CookieWebSocket } from "@/lib/cookie-websocket";
import { API_BASE_URL } from "@/lib/env";

/**
 * `useLocalSearchParams` は実行時に `string[]` や `undefined` を返しうる。型引数は
 * それを隠すだけなので実際に確かめる。**確かめた結果でフックの数が変わらないよう**、
 * ガードはここに置いて中身を別のコンポーネントに分けている。
 */
export default function ChatScreen() {
  const params = useLocalSearchParams();
  const threadId = typeof params.threadId === "string" ? params.threadId : null;

  if (!threadId) return <Redirect href="/" />;

  return <Chat threadId={threadId} />;
}

function Chat({ threadId }: { threadId: string }) {
  const [input, setInput] = useState("");

  // agent-per-thread: インスタンス名を threadId にすることで
  // スレッドごとに独立した Durable Object（＝独立した会話履歴）になる。
  //
  // WebSocket には cookie が自動で載らないので実装ごと差し替える（docs/adr/0001）。
  const agent = useAgent({
    agent: "chat-agent",
    name: threadId,
    host: API_BASE_URL,
    WebSocket: CookieWebSocket,
  });

  // 初期メッセージの取得だけは通常の HTTP なので、ヘッダで cookie を渡す。
  // credentials を omit にしないと手で入れた Cookie が上書きされうる。
  const { messages, sendMessage, status, clearHistory } = useAgentChat({
    agent,
    credentials: "omit",
    headers: { Cookie: currentCookie() },
  });

  const busy = status === "streaming" || status === "submitted";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ThreadFiles threadId={threadId} />

      <FlatList
        className="flex-1"
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerClassName="gap-3 p-4"
        ListEmptyComponent={
          <Text className="p-6 text-center text-muted-foreground">
            まだメッセージがない。メッセージを送ると会話が始まる。添付ファイルの内容も聞ける。
          </Text>
        }
        renderItem={({ item }) => <MessageParts message={item} />}
        ListFooterComponent={status === "submitted" ? <ActivityIndicator /> : null}
      />

      <View className="flex-row items-center gap-2 border-t border-border p-4">
        <TextInput
          accessibilityLabel="メッセージを入力"
          testID="message-input"
          className="flex-1 rounded-lg border border-input bg-card px-3 py-3 text-foreground"
          placeholder="メッセージを入力"
          value={input}
          onChangeText={setInput}
        />
        <Pressable
          accessibilityLabel="送信"
          testID="send-message"
          accessibilityRole="button"
          className="justify-center rounded-lg bg-primary px-4 py-3 active:opacity-80"
          disabled={busy}
          onPress={() => {
            if (!input.trim() || busy) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <Text className="font-semibold text-primary-foreground">送信</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="履歴消去"
          accessibilityRole="button"
          className="justify-center rounded-lg border border-border px-3 py-3"
          onPress={clearHistory}
        >
          <Text className="text-muted-foreground">消去</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
