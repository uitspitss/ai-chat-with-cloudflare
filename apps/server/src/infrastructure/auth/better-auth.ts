import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
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
    /**
     * **`aichat://` を trustedOrigins に入れるだけでは効かない。** RN の fetch は
     * `Origin` を送らず、Expo クライアントが送るのは `expo-origin`。それを `origin`
     * に写すのがこのプラグインの `onRequest` で、無いと照合対象が空のままになる。
     *
     * 表に出るのは**サインアウトだけ**。cookie を持たないサインイン / サインアップは
     * origin 検査に到達しないので、抜けていてもアプリは通しで動いてしまう。
     */
    plugins: [expo()],
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
