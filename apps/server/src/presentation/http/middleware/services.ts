import { createMiddleware } from "hono/factory";
import { createServices } from "../../../composition-root";
import type { AppEnv } from "../../../env";

/**
 * 合成ルートを `c.var.services` として配る。
 *
 * Hono は DI コンテナを規定していないが、**リクエスト内で値を共有する仕組みとして
 * `c.set()` / `c.var` を挙げている**ので、それに乗せる。
 * 各ハンドラで `createServices(c.env)` を呼ぶと、同じ組み立てがハンドラの数だけ
 * 繰り返される（リクエストごとに 1 回で足りる）。
 */
export const injectServices = createMiddleware<AppEnv>(async (c, next) => {
  c.set("services", createServices(c.env));
  await next();
});
