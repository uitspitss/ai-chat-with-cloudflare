import { createAuthClient } from "better-auth/react";

// baseURL 未指定なら現在のオリジン + /api/auth を見る。
// dev は Vite の proxy がそのまま wrangler へ流す。
export const authClient = createAuthClient({
  basePath: "/api/auth",
});

export const { signIn, signUp, signOut, useSession } = authClient;
