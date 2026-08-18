import { zValidator } from "@hono/zod-validator";
import type { ApiError } from "@repo/schema";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

/**
 * zValidator の薄いラッパ。**失敗時のボディを ApiError に揃える**ためだけに存在する。
 *
 * 素の zValidator は zod の SafeParseError をそのまま返すので、
 * API のエラー形式が 2 種類（zod 形式とこちらの ApiError）になり、
 * クライアントが分岐できなくなる。
 *
 * ここが返すのは形式違反（uuid でない等）だけ。業務ルール違反
 * （タイトルが長すぎる、ファイルが大きすぎる）は domain が個別のコードで返す。
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const body: ApiError = {
        code: "VALIDATION_FAILED",
        message: result.error.issues[0]?.message ?? "リクエストの形式が不正",
      };
      return c.json(body, 400);
    }
  });
}
