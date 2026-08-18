import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { createAuth } from "../../infrastructure/auth/better-auth";
import { filesRoute } from "./routes/files";
import { threadsRoute } from "./routes/threads";

// RPC の型推論のためメソッドチェーンで書く（途中で app.route(...) を分けない）。
export const app = new Hono<AppEnv>()
  .basePath("/api")
  // サインアップ / サインイン / セッション取得。requireAuth より前に置く。
  .all("/auth/*", (c) => createAuth(c.env).handler(c.req.raw))
  .route("/threads", threadsRoute)
  .route("/files", filesRoute);

export type AppType = typeof app;
