import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import { createServices } from "../../composition-root";
import { ThreadId } from "../../domain/shared/id";
import type { Bindings } from "../../env";
import { selectModel } from "../../infrastructure/ai/model";
import { createTools } from "./tools";

const SYSTEM_PROMPT = `あなたは日本語で応答するアシスタントです。
この会話にはファイルが添付されていることがあります。
ファイルの内容に関する質問には、推測せず listThreadFiles / readThreadFile を使って実物を読んでから答えてください。`;

/**
 * WebSocket 側の delivery mechanism。HTTP ルートと同じ立ち位置（presentation）で、
 * ユースケースは application、LLM は infrastructure/ai から取る。
 *
 * Agent インスタンス名 = threadId（agent-per-thread）。
 * 会話履歴は AIChatAgent 内蔵の DO SQLite が持つので、自前のテーブルは作らない。
 */
export class ChatAgent extends AIChatAgent<Bindings> {
  async onChatMessage(
    onFinish: Parameters<AIChatAgent<Bindings>["onChatMessage"]>[0],
    options?: { abortSignal?: AbortSignal },
  ) {
    // 拡張点: 長期メモリ（Agent Memory / Vectorize）を入れるならここで取得して
    // system プロンプトに差し込む。取得自体はコアにインターフェースを切って
    // application 側に置く。
    //   const memories = await this.env.VECTORIZE.query(...)
    //   const system = `${SYSTEM_PROMPT}\n\n# 記憶\n${memories.join("\n")}`
    const system = SYSTEM_PROMPT;

    const { threadService, attachmentService } = createServices(this.env);
    const threadId = ThreadId.parse(this.name);

    // 接続時に onBeforeConnect が所有者であることを確認済み。ここでは
    // インスタンス名しか手元に無いので、所有者をデータから復元して
    // Application Service に渡す（所有者を取らない抜け道を作らないため）。
    // 実際には到達しない: スレッド削除は DO ごと破棄するので WebSocket が切れ、
    // 再接続は onBeforeConnect が 403 で拒否する（実測済み）。
    // ownerId が nullable である以上分岐は要るが、丁寧な応答を用意しても
    // 誰にも届かないので throw のままにしてある。
    const ownerId = await threadService.ownerOf(threadId);
    if (!ownerId) throw new Error(`スレッドが存在しない: ${threadId}`);

    const result = streamText({
      model: await selectModel(this.env),
      system,
      messages: await convertToModelMessages(this.messages),
      tools: createTools(attachmentService, threadId, ownerId),
      // ツール実行 → 結果を見て再度応答、のループを許可する
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
      onFinish,
    });

    // result.toUIMessageStreamResponse() は ai@7 で deprecated（次のメジャーで削除）。
    // 単体ヘルパー + result.stream に置き換える。
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }
}
