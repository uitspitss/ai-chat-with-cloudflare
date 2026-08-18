import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signIn, signUp } from "@/lib/auth";

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo-password-1234");
  const [name, setName] = useState("Demo User");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignIn = mode === "sign-in";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    navigate({ to: "/" });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{isSignIn ? "サインイン" : "アカウントを作る"}</CardTitle>
            <CardDescription>
              {isSignIn
                ? "登録済みのメールアドレスでログインする"
                : "メールアドレスとパスワードで登録する"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              {!isSignIn && (
                <Field>
                  <FieldLabel htmlFor="name">名前</FieldLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
              )}

              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">パスワード</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  aria-invalid={error ? true : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>認証に失敗した</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>

          <CardFooter className="flex-col gap-2">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {isSignIn ? "サインイン" : "登録"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setMode(isSignIn ? "sign-up" : "sign-in");
                setError(null);
              }}
            >
              {isSignIn ? "アカウントを作る" : "既にアカウントがある場合はこちら"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

export const Route = createFileRoute("/sign-in")({ component: SignInPage });
