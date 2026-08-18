import { z } from "zod";

/**
 * API のエラー表現。**サーバー内部の `AppError` とは別物**で、こちらがワイヤ契約。
 *
 * 内部の判別可能ユニオンをそのまま外に出さないのは、
 * - ドメインの語彙（`domain/errors.ts`）はサーバーの内側に属し、外へ公開すると
 *   内部のリファクタがクライアントの破壊的変更になる
 * - `domain/` が `@repo/schema` を import する形になり、依存が逆流する
 * から。変換は `presentation/http/error-response.ts` が担う（dto.ts と同じ構図）。
 */
export const apiErrorCodeSchema = z.enum([
  /** 形式が不正（uuid でない等）。業務ルール違反は個別のコードで返る。 */
  "VALIDATION_FAILED",
  /** 未認証。認可の失敗は所有者から見て「存在しない」ので THREAD_NOT_FOUND 側に出る。 */
  "UNAUTHORIZED",
  "THREAD_NOT_FOUND",
  "ATTACHMENT_NOT_FOUND",
  "CONTENT_NOT_UPLOADED",
  "CONTENT_TOO_LARGE",
  "LENGTH_REQUIRED",
  "INVALID_TITLE",
  "INVALID_FILE_SIZE",
  "INVALID_CONTENT_TYPE",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  /** そのまま画面に出せる日本語。クライアントは code で分岐してもよい。 */
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
