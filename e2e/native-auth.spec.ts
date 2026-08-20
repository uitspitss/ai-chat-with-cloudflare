import { expect, request as playwrightRequest, test } from "@playwright/test";

/**
 * ネイティブの形をした認証リクエストが通ることを見る。
 *
 * **ブラウザと違い RN の fetch は `Origin` を付けない。** 代わりに Better Auth の
 * Expo クライアントが `expo-origin` を送り、サーバー側の `expo()` プラグインが
 * それを `origin` に写す。プラグインが外れると cookie 付きの POST だけが
 * MISSING_OR_NULL_ORIGIN で 403 になる——サインイン / サインアップは cookie が
 * 無いので origin 検査に到達せず、**アプリを通しで動かしても気づけない**。
 *
 * `apps/mobile` の単体テストにも Maestro にも出ない結線なのでここで固定する。
 */

const EXPO_ORIGIN = "aichat:///"; // Linking.createURL("", { scheme: "aichat" }) が返す形

test("Origin 無し + expo-origin でサインアウトが通る", async ({ baseURL }) => {
  // 共有の storageState を使うと他のテストのセッションまで revoke してしまう
  const context = await playwrightRequest.newContext({ baseURL });
  const email = `native-signout-${Date.now()}@example.test`;

  // **セットアップはブラウザの形で作る。** Playwright は RN と違って `Sec-Fetch-*` を
  // 送るので、cookie がまだ無いサインアップでも origin 検査が強制される
  // （`validateFormCsrf`）。ここはテスト対象ではないので素直に origin を付ける。
  const signUp = await context.post("/api/auth/sign-up/email", {
    data: { email, password: "native-password-1234", name: "Native User" },
    headers: { origin: baseURL ?? "" },
  });
  expect(signUp.ok()).toBe(true);

  // サインイン済みであることを確かめてから消す（消えたことに意味を持たせる）
  expect((await context.get("/api/threads")).status()).toBe(200);

  const signOut = await context.post("/api/auth/sign-out", {
    // Better Auth の router は application/json 以外を 415 で弾くので、
    // 本文が要らない sign-out でも content-type は要る（better-fetch も同じ形で送る）
    data: {},
    headers: { "expo-origin": EXPO_ORIGIN },
  });
  expect(signOut.status()).toBe(200);

  // 200 のときだけ期限切れの Set-Cookie が返り、cookie jar が空になる。
  // 403 だと cookie が残ったままなのでここは 200 に戻ってしまう。
  //
  // （cookieCache が 5 分残るので「保存した cookie を replay したら 401」は
  //   成立しない。サーバー側の行が消えたことまでは E2E からは見られない）
  expect((await context.get("/api/threads")).status()).toBe(401);

  await context.dispose();
});
