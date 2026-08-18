import type { ApiError } from "@repo/schema";
import { match } from "ts-pattern";
import type { AppError } from "../../domain/errors";

/**
 * 内部の AppError → ワイヤの ApiError。**`.exhaustive()` なので、AppError に
 * 枝を足すとここがコンパイルエラーになる**（対応漏れを実行時まで持ち越さない）。
 *
 * status をリテラル union のままにしておくこと。`ContentfulStatusCode` のような
 * 広い型にすると Hono RPC が成功レスポンスと区別できなくなり、
 * クライアント側で `res.ok` による絞り込みが効かなくなる。
 */
export function toHttpError(error: AppError): {
  body: ApiError;
  status: 400 | 404 | 411 | 413;
} {
  return match(error)
    .with({ type: "ThreadNotFound" }, () => ({
      body: { code: "THREAD_NOT_FOUND" as const, message: "スレッドが見つからない" },
      status: 404 as const,
    }))
    .with({ type: "AttachmentNotFound" }, () => ({
      body: { code: "ATTACHMENT_NOT_FOUND" as const, message: "ファイルが見つからない" },
      status: 404 as const,
    }))
    .with({ type: "ContentNotUploaded" }, () => ({
      body: {
        code: "CONTENT_NOT_UPLOADED" as const,
        message: "ファイル本体がまだアップロードされていない",
      },
      status: 404 as const,
    }))
    .with({ type: "ContentTooLarge" }, () => ({
      body: {
        code: "CONTENT_TOO_LARGE" as const,
        message: "申告したサイズより大きい本文が送られた",
      },
      status: 413 as const,
    }))
    .with({ type: "LengthRequired" }, () => ({
      body: {
        code: "LENGTH_REQUIRED" as const,
        message: "Content-Length が必要（長さが確定しないと上限を担保できない）",
      },
      status: 411 as const,
    }))
    .with({ type: "InvalidTitle" }, (e) => ({
      body: { code: "INVALID_TITLE" as const, message: e.message },
      status: 400 as const,
    }))
    .with({ type: "InvalidFileSize" }, (e) => ({
      body: { code: "INVALID_FILE_SIZE" as const, message: e.message },
      status: 400 as const,
    }))
    .with({ type: "InvalidContentType" }, (e) => ({
      body: { code: "INVALID_CONTENT_TYPE" as const, message: e.message },
      status: 400 as const,
    }))
    .exhaustive();
}
