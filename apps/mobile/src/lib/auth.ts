import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { API_BASE_URL } from "./env";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  // cookie は SecureStore に入る。scheme は app.json と揃えること
  // （ズレると OAuth のコールバックと trustedOrigins の判定が食い違う）。
  plugins: [expoClient({ storage: SecureStore, scheme: "aichat" })],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * cookie の写し。**WebSocket のコンストラクタは `await` できない**ので、
 * 同期で読める場所に置いておく必要がある（`lib/cookie-websocket.ts`）。
 *
 * better-auth 1.6 の `getCookie()` は同期だが、1.7 で非同期になる。
 * そのときに直すのは**このファイルだけ**で済むようにここへ閉じてある。
 */
let cachedCookie = "";

export function currentCookie(): string {
  return cachedCookie;
}

export function refreshCookie(): string {
  cachedCookie = authClient.getCookie();
  return cachedCookie;
}

refreshCookie();

// サーバー側の cookieCache は 5 分で切れる。アプリを長時間バックグラウンドに
// 置いた後の復帰で古い cookie を掴まないよう、戻ってきたら読み直す。
AppState.addEventListener("change", (state) => {
  if (state === "active") refreshCookie();
});
