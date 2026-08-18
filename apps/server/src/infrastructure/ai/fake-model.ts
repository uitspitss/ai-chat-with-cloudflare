import type {
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * E2E 専用の決定的なモデル。**`E2E_FAKE_LLM=1` のときだけ動的 import される**ので、
 * 本番バンドルには入らない（infrastructure/ai/model.ts 参照）。
 *
 * 実物の Workers AI を E2E に使うとリモート接続に依存し、実際に
 * `Error: Network connection lost.` でストリームが途中で切れることがある。
 * ツール呼び出しのループまで含めて毎回同じ結果を返す器が要る。
 *
 * 挙動: 1 ステップ目で readThreadFile を呼び、2 ステップ目でその結果を文章にする。
 */

export const FAKE_ANSWER = "既知の問題は Safari でスクロール位置が復元されない点です。";

const usage: LanguageModelV4Usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const finish = (unified: LanguageModelV4FinishReason["unified"]): LanguageModelV4StreamPart => ({
  type: "finish",
  finishReason: { unified, raw: unified },
  usage,
});

const TOOL_CALL_STEP: LanguageModelV4StreamPart[] = [
  { type: "stream-start", warnings: [] },
  { type: "response-metadata", id: "e2e-1", modelId: "e2e-fake" },
  {
    type: "tool-call",
    toolCallId: "e2e-call-1",
    toolName: "readThreadFile",
    input: JSON.stringify({ name: "release-notes.md" }),
  },
  finish("tool-calls"),
];

const ANSWER_STEP: LanguageModelV4StreamPart[] = [
  { type: "stream-start", warnings: [] },
  { type: "response-metadata", id: "e2e-2", modelId: "e2e-fake" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: FAKE_ANSWER },
  { type: "text-end", id: "t1" },
  finish("stop"),
];

export function createFakeModel() {
  let step = 0;

  return new MockLanguageModelV4({
    provider: "e2e-fake",
    modelId: "e2e-fake",
    doStream: async () => {
      step += 1;
      return {
        stream: simulateReadableStream({
          chunks: step === 1 ? TOOL_CALL_STEP : ANSWER_STEP,
          chunkDelayInMs: 1,
        }),
      };
    },
  });
}
