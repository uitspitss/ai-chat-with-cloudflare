import { threadsKey } from "@repo/app-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { appApi } from "@/lib/api";
import { signOut } from "@/lib/auth";

function SignOutButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => signOut()}>
      <Text className="text-muted-foreground">サインアウト</Text>
    </Pressable>
  );
}

export default function ThreadListScreen() {
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
      router.push({ pathname: "/threads/[threadId]", params: { threadId: thread.id } });
    },
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => appApi.deleteThread(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });

  const failure = threads.error ?? createThread.error ?? deleteThread.error;

  return (
    <View className="flex-1 gap-3 bg-background p-4">
      <Stack.Screen options={{ headerRight: SignOutButton }} />

      <View className="flex-row gap-2">
        <TextInput
          accessibilityLabel="新しいスレッドのタイトル"
          testID="thread-title-input"
          className="flex-1 rounded-lg border border-input bg-card px-3 py-3 text-foreground"
          placeholder="新しいスレッドのタイトル"
          value={title}
          onChangeText={setTitle}
        />
        <Pressable
          accessibilityRole="button"
          testID="create-thread"
          className="justify-center rounded-lg bg-primary px-4 active:opacity-80"
          disabled={createThread.isPending}
          onPress={() => createThread.mutate(title)}
        >
          <Text className="font-semibold text-primary-foreground">作成</Text>
        </Pressable>
      </View>

      {failure && (
        <View className="rounded-lg border border-destructive p-3">
          <Text className="text-destructive">{failure.message}</Text>
        </View>
      )}

      {threads.isPending ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={threads.data}
          keyExtractor={(thread) => thread.id}
          contentContainerClassName="gap-2"
          ListEmptyComponent={
            <Text className="p-6 text-center text-muted-foreground">
              スレッドがまだない。上のフォームからタイトルを入れて作成する。
            </Text>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-2 rounded-lg border border-border p-4">
              <Pressable
                accessibilityRole="button"
                className="flex-1"
                onPress={() =>
                  router.push({
                    pathname: "/threads/[threadId]",
                    params: { threadId: item.id },
                  })
                }
              >
                <Text className="text-foreground">{item.title}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`${item.title} を削除`}
                accessibilityRole="button"
                onPress={() => deleteThread.mutate(item.id)}
              >
                <Text className="text-destructive">削除</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
