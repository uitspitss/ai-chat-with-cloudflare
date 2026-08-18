import { createMiddleware } from "hono/factory";
import { UserId } from "../../../domain/shared/id";
import type { AppEnv } from "../../../env";
import { createAuth } from "../../../infrastructure/auth/better-auth";

/**
 * Better Auth のセッションから userId を解決する。認可の実体はここ。
 * 以降のレイヤーは c.get("userId") しか見ないので、認証方式を差し替えても波及しない。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  // ApiError の形（{ code, message }）に揃える。ここだけ独自形状にすると
  // クライアントの apiError() がパースに失敗し、汎用フォールバック文言になる
  if (!session) {
    return c.json({ code: "UNAUTHORIZED" as const, message: "サインインが必要" }, 401);
  }

  c.set("userId", UserId.parse(session.user.id));
  await next();
});
