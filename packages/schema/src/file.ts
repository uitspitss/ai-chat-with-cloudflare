import { z } from "zod";

export const fileMetaSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  userId: z.string(),
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
  createdAt: z.number(),
});

export type FileMeta = z.infer<typeof fileMetaSchema>;

/**
 * ダウンロード時に `content-disposition` の `filename*` へ percent-encode するので、
 * **単独のサロゲート（`\uD800` 単体など）を通すと `encodeURIComponent` が
 * `URIError` を投げる。** 登録は成功して取得だけが永久に 500 になり、API では
 * 直せなくなるので入口で弾く。
 */
const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !/\p{Surrogate}/u.test(value), {
    message: "ファイル名に不正な文字が含まれている",
  });

export const uploadUrlRequestSchema = z.object({
  threadId: z.uuid(),
  name: fileNameSchema,
  // 上限（25MB）は業務ルールなので domain/attachment.ts が持つ
  size: z.number().int().positive(),
  contentType: z.string().min(1).max(255),
});

export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

/**
 * `uploadUrl` へ `method` でボディをそのまま送るとアップロードが完了する。
 *
 * **`uploadUrl` は API のベース URL からの相対パス。** 絶対 URL にしないのは、
 * dev のプロキシ構成でサーバーが自分のオリジンを正しく知れないため。
 * ブラウザ以外のクライアント（Expo / Node）は `resolveApiUrl(baseUrl, uploadUrl)`
 * （`@repo/api-client`）で解決してから fetch すること。
 *
 * 現状は R2 binding 経由の Worker エンドポイントを返す。R2 の S3 互換 API で
 * 本物の presigned URL を発行する構成に差し替えても、クライアント側の手順
 * （この URL に PUT する）は変わらないようにしてある。
 */
export const uploadUrlResponseSchema = z.object({
  fileId: z.string(),
  uploadUrl: z.string(),
  method: z.literal("PUT"),
});

export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

export const downloadUrlResponseSchema = z.object({
  file: fileMetaSchema,
  downloadUrl: z.string(),
});

export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;
