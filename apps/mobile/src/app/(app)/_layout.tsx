import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/auth";

/**
 * 守られた領域。**サインイン画面はこのグループの外**（`(auth)/`）に置いてある。
 * 同じ階層に置くとガードが自分自身にも掛かってリダイレクトが循環する。
 * web の `beforeLoad: requireSession` と同じ役割。
 */
export default function AppLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "スレッド" }} />
      <Stack.Screen name="threads/[threadId]" options={{ title: "チャット" }} />
    </Stack>
  );
}
