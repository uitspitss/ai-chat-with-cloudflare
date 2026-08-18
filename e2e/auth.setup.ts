import { mkdir } from "node:fs/promises";
import { test as setup } from "@playwright/test";

export const E2E_USER = {
  email: "e2e@example.test",
  password: "e2e-password-1234",
  name: "E2E User",
};

const authFile = ".auth/user.json";

/**
 * UI からログインせず API を叩いてセッションを取る。
 * 画面操作は遅く、サインイン画面の変更で全テストが道連れになる。
 *
 * better-auth の `testUtils` プラグインは使えない。あれは Node から DB へ
 * 直接繋げる前提で、この構成の D1 は Worker の中にしか無いため。
 */
setup("authenticate", async ({ request, baseURL }) => {
  // Better Auth は Origin 無しのリクエストを MISSING_OR_NULL_ORIGIN で弾く
  const headers = { origin: baseURL ?? "" };

  const res = await request.post("/api/auth/sign-up/email", { data: E2E_USER, headers });

  // サーバーを使い回す（--ui / reuseExistingServer）と D1 が消えないのでユーザーが残る。
  // その場合は sign-in に切り替える（seed.ts と同じ手当て）。
  if (!res.ok()) {
    const signIn = await request.post("/api/auth/sign-in/email", {
      data: { email: E2E_USER.email, password: E2E_USER.password },
      headers,
    });
    if (!signIn.ok()) {
      throw new Error(
        `sign-up (${res.status()}) も sign-in (${signIn.status()}) も失敗: ${await signIn.text()}`,
      );
    }
  }

  await mkdir(".auth", { recursive: true });
  await request.storageState({ path: authFile });
});
