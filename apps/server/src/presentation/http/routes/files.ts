import { uploadUrlRequestSchema } from "@repo/schema";
import { Hono } from "hono";
import { z } from "zod";
import { AttachmentId, ThreadId } from "../../../domain/shared/id";
import type { AppEnv } from "../../../env";
import { toFileDto } from "../dto";
import { toHttpError } from "../error-response";
import { requireAuth } from "../middleware/auth";
import { injectServices } from "../middleware/services";
import { validate } from "../validator";

// Attachment は独立した集約ルートなので、URL も /api/files/:id で直接アドレスする
// （FK があるからといって /api/threads/:threadId/files/:id にはしない）。
const attachmentParam = validate("param", z.object({ id: AttachmentId }));

/**
 * RFC 5987 の `filename*` を付ける。**`filename="${encodeURIComponent(name)}"` は誤り**で、
 * ブラウザはパーセントエンコードを解かずにそのまま表示するため、日本語のファイル名が
 * `%E8%AB%87...` として保存される。ASCII 版は非対応ブラウザ向けのフォールバック。
 */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export const filesRoute = new Hono<AppEnv>()
  .use("*", injectServices, requireAuth)
  .get("/", validate("query", z.object({ threadId: ThreadId })), async (c) => {
    const found = await c.var.services.attachmentService.listByThread(
      c.get("userId"),
      c.req.valid("query").threadId,
    );
    if (found.isErr()) {
      const { body, status } = toHttpError(found.error);
      return c.json(body, status);
    }
    return c.json(found.value.map(toFileDto));
  })
  .post("/upload-url", validate("json", uploadUrlRequestSchema), async (c) => {
    const body = c.req.valid("json");
    const registered = await c.var.services.attachmentService.register(c.get("userId"), {
      ...body,
      threadId: ThreadId.parse(body.threadId),
    });
    if (registered.isErr()) {
      const e = toHttpError(registered.error);
      return c.json(e.body, e.status);
    }

    // R2 の S3 互換 API で presigned URL を発行する構成にも差し替えられるよう、
    // 「返された URL に PUT する」というクライアント側の手順だけを契約にしている。
    return c.json(
      {
        fileId: registered.value.id as string,
        uploadUrl: `/api/files/${registered.value.id}/content`,
        method: "PUT" as const,
      },
      201,
    );
  })
  .put("/:id/content", attachmentParam, async (c) => {
    // **ボディが無くてもここで打ち切らない。** 早期 return すると登録済みの
    // メタデータ行が残り、一覧に出るのにダウンロードは 404 になる。
    // サービスに渡せば長さ 0 として弾かれ、その行も後始末される。
    const declared = Number(c.req.header("content-length"));
    const uploaded = await c.var.services.attachmentService.uploadContent(
      c.req.valid("param").id,
      c.get("userId"),
      c.req.raw.body ?? new ReadableStream(),
      Number.isFinite(declared) ? declared : undefined,
    );
    if (uploaded.isErr()) {
      const { body, status } = toHttpError(uploaded.error);
      return c.json(body, status);
    }
    return c.json(toFileDto(uploaded.value));
  })
  .get("/:id", attachmentParam, async (c) => {
    const found = await c.var.services.attachmentService.findById(
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (found.isErr()) {
      const { body, status } = toHttpError(found.error);
      return c.json(body, status);
    }
    return c.json({
      file: toFileDto(found.value),
      downloadUrl: `/api/files/${found.value.id}/content`,
    });
  })
  .get("/:id/content", attachmentParam, async (c) => {
    const opened = await c.var.services.attachmentService.openDownload(
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (opened.isErr()) {
      const { body, status } = toHttpError(opened.error);
      return c.json(body, status);
    }

    // content-type はクライアントの申告をそのまま返すので、ブラウザに勝手な
    // 推測をさせない。同一オリジンで配るため、sniff されると text/plain の
    // アップロードが HTML として実行されうる。
    return new Response(opened.value.body, {
      headers: {
        "content-type": opened.value.attachment.contentType,
        "content-disposition": contentDisposition(opened.value.attachment.name),
        "x-content-type-options": "nosniff",
      },
    });
  });
