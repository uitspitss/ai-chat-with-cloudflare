import type { AppType } from "@repo/server";
import { hc } from "hono/client";

export type ApiClient = ReturnType<typeof hc<AppType>>;

/**
 * Web は相対 URL（Vite の proxy / 本番は同一 Worker）、Expo は絶対 URL を渡す。
 *
 * `credentials: "include"` は Better Auth のセッション cookie を載せるために必須。
 * 絶対 URL で叩く場合はサーバー側 TRUSTED_ORIGINS にそのオリジンを入れること。
 */
export function createApiClient(baseUrl: string, fetchImpl?: typeof fetch) {
  return hc<AppType>(baseUrl, {
    fetch: fetchImpl,
    init: { credentials: "include" },
  });
}

/**
 * API が返す相対パス（`uploadUrl` / `downloadUrl`）を絶対 URL に直す。
 *
 * **サーバーが絶対 URL を返す形にはしない。** dev では Vite（:5173）が
 * wrangler（:8787）へプロキシしており、サーバーが自分の `c.req.url` を基に
 * 絶対 URL を作ると :8787 を指す。ブラウザがそこへ直接 PUT するとクロスオリジンになり、
 * セッション cookie が載らない。**どのオリジンから見えているかはクライアントしか
 * 知らない**ので、解決はクライアント側の責務にしてある。
 *
 * Web は baseUrl が "/" なので実質そのまま。Expo など絶対 URL を渡す環境で効く。
 */
export function resolveApiUrl(baseUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  if (baseUrl.startsWith("/")) return pathOrUrl;
  return new URL(pathOrUrl, baseUrl).toString();
}
