import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { refreshCookie } from "@/lib/api";
import { signIn, signUp, useSession } from "@/lib/auth";

export default function SignInScreen() {
  const { data: session } = useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignIn = mode === "sign-in";

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const result = isSignIn
      ? await signIn.email({ email, password })
      : await signUp.email({ email, password, name });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "認証に失敗した");
      return;
    }

    // SecureStore に入った新しい cookie を写しに反映する。
    // これを忘れると WebSocket だけ古い cookie で 403 になる。
    refreshCookie();
  }

  // **命令的に router.replace("/") しない。** それだと `useSession()` の更新より
  // 先に遷移してしまい、(app) のガードが「未認証」と判断してここへ押し戻す。
  // ガードと同じストアを見て宣言的に出れば、その競合が構造的に起きない。
  if (session) return <Redirect href="/" />;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerClassName="grow justify-center gap-4 p-6">
          <View className="gap-1">
            <Text className="text-2xl font-semibold text-foreground">
              {isSignIn ? "サインイン" : "アカウントを作る"}
            </Text>
            <Text className="text-muted-foreground">
              {isSignIn
                ? "登録済みのメールアドレスでログインする"
                : "メールアドレスとパスワードで登録する"}
            </Text>
          </View>

          {!isSignIn && (
            <View className="gap-1.5">
              <Text className="text-foreground">名前</Text>
              <TextInput
                accessibilityLabel="名前"
                testID="name-input"
                className="rounded-lg border border-input bg-card px-3 py-3 text-foreground"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
              />
            </View>
          )}

          <View className="gap-1.5">
            <Text className="text-foreground">メールアドレス</Text>
            <TextInput
              accessibilityLabel="メールアドレス"
              testID="email-input"
              className="rounded-lg border border-input bg-card px-3 py-3 text-foreground"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-foreground">パスワード</Text>
            <TextInput
              accessibilityLabel="パスワード"
              testID="password-input"
              className="rounded-lg border border-input bg-card px-3 py-3 text-foreground"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              secureTextEntry
            />
          </View>

          {error && (
            <View testID="auth-error" className="rounded-lg border border-destructive p-3">
              <Text className="text-destructive">{error}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            testID="auth-submit"
            className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 active:opacity-80"
            disabled={pending}
            onPress={handleSubmit}
          >
            {pending && <ActivityIndicator />}
            <Text className="font-semibold text-primary-foreground">
              {isSignIn ? "サインイン" : "登録"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            testID="auth-toggle-mode"
            className="items-center py-2"
            onPress={() => {
              setMode(isSignIn ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            <Text className="text-muted-foreground">
              {isSignIn ? "アカウントを作る" : "既にアカウントがある場合はこちら"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
