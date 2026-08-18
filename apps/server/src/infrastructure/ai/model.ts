import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Bindings } from "../../env";

// ツール呼び出しを素直に出せるモデルを選ぶこと。llama-3.3-70b-fp8-fast は
// function call を JSON テキストとして本文に吐いてしまい、ツールが実行されない。
const WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * プロバイダーの切り替えはここ 1 箇所に閉じる。
 * 既定は Workers AI（`wrangler dev` からローカルでも呼べる）。
 * ANTHROPIC_API_KEY があれば Anthropic を使う。
 */
export async function selectModel(env: Bindings): Promise<LanguageModel> {
  // E2E 専用。**既定は閉じている**（フラグの立ち忘れで壊れる向き）。
  // 動的 import なので本番バンドルに ai/test は入らない。
  if (env.E2E_FAKE_LLM === "1") {
    const { createFakeModel } = await import("./fake-model");
    return createFakeModel();
  }

  if (env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(ANTHROPIC_MODEL);
  }
  return createWorkersAI({ binding: env.AI })(WORKERS_AI_MODEL);
}
