import type { Services } from "./composition-root";
import type { UserId } from "./domain/shared/id";
import type { ChatAgent } from "./presentation/agent/chat-agent";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  AI: Ai;
  /** 設定されていれば Anthropic に切り替わる（src/infrastructure/ai/model.ts） */
  ANTHROPIC_API_KEY?: string;
  /** Better Auth のセッション署名鍵。必須。 */
  BETTER_AUTH_SECRET: string;
  /** 例: http://localhost:5173 / https://example.com */
  BETTER_AUTH_URL: string;
  /** カンマ区切り。dev では Vite のオリジンを入れる。 */
  TRUSTED_ORIGINS?: string;
  /** "1" のとき決定的なダミー LLM を使う。**E2E 専用**で本番では設定しない。 */
  E2E_FAKE_LLM?: string;
  /**
   * 会話履歴を持つ DO。**具象クラスで型付けする** — `getAgentByName` に渡して
   * RPC（`destroy()` など）を型付きで呼ぶために要る。
   * 型のみの循環参照（env → chat-agent → env）だが実行時の依存は無い。
   */
  ChatAgent: DurableObjectNamespace<ChatAgent>;
};

type Variables = {
  /** 認証ミドルウェアが注入する。 */
  userId: UserId;
  /** injectServices が注入する。Hono 流の per-request な受け渡し（c.var）。 */
  services: Services;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
