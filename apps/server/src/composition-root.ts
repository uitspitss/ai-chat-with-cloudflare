import { drizzle } from "drizzle-orm/d1";
import { createAttachmentService } from "./application/attachment-service";
import { createThreadService } from "./application/thread-service";
import type { Bindings } from "./env";
import { createAgentConversationStore } from "./infrastructure/agents/conversation-store";
import { createD1AttachmentRepository } from "./infrastructure/d1/attachment-repository";
import { createD1ThreadRepository } from "./infrastructure/d1/thread-repository";
import { createR2FileStorage } from "./infrastructure/r2/file-storage";

/**
 * Composition Root（合成ルート）。**具象 adapter を結線するのはここだけ。**
 *
 * **DI コンテナではない。** レジストリもトークン解決もライフサイクル設定も持たず、
 * ただの関数呼び出しで組み立てる（Pure DI）。tsyringe 等と違い、繋ぎ間違いは
 * 実行時ではなくコンパイル時に落ちるし、jump-to-definition で辿れる。
 * 他の場所で `drizzle(env.DB)` や `env.BUCKET` を直接触らないこと。
 *
 * Workers はリクエストごとに env を受け取るので、コンテナも都度組み立てる。
 * どれも状態を持たないファクトリなので実質ゼロコスト。
 *
 * **Hono には依存しない。** Hono 側へは `injectServices` ミドルウェアが
 * `c.var.services` として配るが、WebSocket の ChatAgent は Hono を通らないので
 * ここを直接呼ぶ。合成ルートをミドルウェアの中に書いてしまうと、
 * エージェント側で別の配線を用意する羽目になる。
 */
export function createServices(env: Bindings) {
  const db = drizzle(env.DB);
  const threadRepository = createD1ThreadRepository(db);
  const attachmentRepository = createD1AttachmentRepository(db);
  const fileStorage = createR2FileStorage(env.BUCKET);
  const conversationStore = createAgentConversationStore(env.ChatAgent);

  return {
    threadService: createThreadService(
      threadRepository,
      attachmentRepository,
      fileStorage,
      conversationStore,
    ),
    attachmentService: createAttachmentService(attachmentRepository, threadRepository, fileStorage),
  };
}

export type Services = ReturnType<typeof createServices>;
