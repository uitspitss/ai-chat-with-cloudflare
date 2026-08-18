import { getAgentByName } from "agents";
import type { ConversationStore } from "../../domain/ports/conversation-store";
import type { Bindings } from "../../env";
import type { ChatAgent } from "../../presentation/agent/chat-agent";

/**
 * 会話履歴は ChatAgent（Durable Object）内蔵の SQLite にあるので、
 * 消すには DO 本体を破棄するしかない。
 *
 * 戻り値型を明示して、adapter が port を満たしに行く形にする
 * （`ReturnType<typeof ...>` で推論しない）。
 */
export function createAgentConversationStore(namespace: Bindings["ChatAgent"]): ConversationStore {
  return {
    destroy: async (threadId) => {
      const agent = await getAgentByName<Bindings, ChatAgent>(namespace, threadId);
      try {
        await agent.destroy();
      } catch (cause) {
        // destroy() は最後に isolate を abort するので、RPC の呼び出し側には
        // 切断エラーが返る。**DO 側の破棄は完了している**ため成功として扱う。
        // ponytail: abort と本物の失敗を区別できない。区別が要るなら
        // destroy 前に「消したか」を問い合わせる callable を足す
        if (!isIsolateAbort(cause)) throw cause;
      }
    },
  };
}

/** 破棄に伴う isolate の abort か。それ以外（バインディング不正など）は握り潰さない。 */
function isIsolateAbort(cause: unknown): boolean {
  return cause instanceof Error && /reset because|abort/i.test(cause.message);
}
