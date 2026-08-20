import { createAppApi } from "@repo/app-api";
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
