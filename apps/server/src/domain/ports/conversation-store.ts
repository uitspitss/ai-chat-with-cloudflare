import type { ThreadId } from "../shared/id";

/**
 * 会話履歴の置き場。実体は ChatAgent（Durable Object）内蔵の SQLite だが、
 * この port は「スレッドごとに履歴があり、消せる」ことしか約束しない
 * （テストはインメモリの adapter を差せる）。
 */
export type ConversationStore = {
  /** 履歴ごと破棄する。存在しないスレッドを渡しても失敗しないこと（削除は冪等） */
  destroy(threadId: ThreadId): Promise<void>;
};
