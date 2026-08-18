import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../d1/schema";
import type { Bindings } from "../../env";

/**
 * D1 binding はリクエストごとにしか手に入らないので、auth インスタンスも
 * リクエストごとに組み立てる。Worker の起動コストに乗るだけで状態は持たない。
 */
export function createAuth(env: Bindings) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) ?? [],
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      // 検証メールの送信基盤はまだ無いので、サインアップ直後から使える状態にする
      requireEmailVerification: false,
    },
    session: {
      // WebSocket 接続のたびに DB を引かないよう cookie にキャッシュする
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}
