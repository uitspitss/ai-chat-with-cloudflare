import { createAppApi } from "@repo/app-api";
import { Directory, File, Paths } from "expo-file-system";
import { authHeaders } from "./auth";
import { API_BASE_URL } from "./env";

/**
 * ネイティブでは cookie jar の挙動が iOS / Android で違うので、Better Auth の
 * cookie を**明示的にヘッダへ載せる**。`credentials: "omit"` にしないと、
 * fetch 側の cookie 処理が手で入れた `Cookie` を上書きすることがある。
 *
 * REST・`/get-messages`・WebSocket の 3 経路すべてがこの同じ仕組みに乗る
 * （WebSocket は `lib/cookie-websocket.ts`）。
 */
export const cookieFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(authHeaders())) headers.set(name, value);
  return fetch(input, { ...init, credentials: "omit", headers });
};

export const appApi = createAppApi({ baseUrl: API_BASE_URL, fetch: cookieFetch });

/** WebView の `allowingReadAccessToURL` に渡す。ここより下しか読ませない。 */
export const ATTACHMENT_CACHE_URI = new Directory(Paths.cache, "attachments").uri;

/**
 * 添付をキャッシュへ落として `file://` の URI を返す。
 *
 * **URL をそのままビューアに渡してはいけない。** `/api/files/:id/content` は認証必須で、
 * SFSafariViewController も WKWebView も SecureStore の cookie を共有しないため 401 に
 * なる。`File.downloadFileAsync` は `headers` を取るので、**REST / get-messages /
 * WebSocket と同じ `authHeaders()` に乗る 4 本目の経路**にできる。
 *
 * ここで落としてから見せるのは、**失敗を握り潰さないため**でもある。リモート URL を
 * WKWebView に直接読ませると 401 が真っ白な画面にしかならず、原因が追えない。
 *
 * 拡張子はそのまま残す。**WKWebView は MIME を拡張子から推測する**ので、`.pdf` を
 * 落とすと剥がれた瞬間にプレビューが空になる。
 */
export async function downloadAttachment(file: { id: string; name: string }): Promise<string> {
  // 名前は他スレッドと衝突しうるので id のディレクトリで隔離する。
  // 名前自体は共有シートやタイトルに出るので保持する（区切り文字だけ潰す）。
  const directory = new Directory(ATTACHMENT_CACHE_URI, file.id);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(directory, file.name.replace(/[/\\]/g, "_"));
  await File.downloadFileAsync(appApi.attachmentContentUrl(file.id), destination, {
    headers: authHeaders(),
    idempotent: true,
  });

  return destination.uri;
}
