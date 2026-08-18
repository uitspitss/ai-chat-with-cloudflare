import { tool } from "ai";
import { match } from "ts-pattern";
import { z } from "zod";
import type { AttachmentService } from "../../application/attachment-service";
import type { ThreadId, UserId } from "../../domain/shared/id";

/**
 * ツールは Application Service を呼ぶだけ。
 * **R2 も D1 もここから触らない**（触ると presentation がインフラに依存する）。
 *
 * threadId と ownerId を閉じ込めて組み立てるので、モデルは他スレッド・他人の
 * ファイルを指定できない。
 */
export function createTools(attachments: AttachmentService, threadId: ThreadId, ownerId: UserId) {
  return {
    getCurrentTime: tool({
      description:
        "現在の日時を ISO 8601 形式で返す。「今」「今日」に依存する質問に答える前に必ず呼ぶこと。",
      inputSchema: z.object({}),
      execute: async () => ({ iso: new Date().toISOString() }),
    }),

    listThreadFiles: tool({
      description:
        "この会話に添付されているファイルの一覧を返す。readThreadFile を使う前にこれでファイル名を確認する。",
      inputSchema: z.object({}),
      execute: async () => {
        const found = await attachments.listByThread(ownerId, threadId);
        if (found.isErr()) return { files: [] };
        return {
          files: found.value.map((a) => ({
            name: a.name,
            size: a.size as number,
            contentType: a.contentType as string,
          })),
        };
      },
    }),

    readThreadFile: tool({
      description:
        "この会話に添付されたファイルの中身をテキストとして読む。ファイル名は listThreadFiles で取得したものを使う。",
      inputSchema: z.object({
        name: z.string().describe("listThreadFiles が返したファイル名"),
      }),
      // ツールの戻り値はモデルが読むので、失敗も例外ではなく説明文として返す
      execute: async ({ name }) => {
        const read = await attachments.readText(ownerId, threadId, name);
        return read.match(
          (value) => value,
          (error) =>
            match(error)
              .with({ type: "AttachmentNotFound" }, () => ({
                error: `"${name}" はこの会話に添付されていない。listThreadFiles で確認すること。`,
              }))
              .with({ type: "ContentNotUploaded" }, () => ({
                error: `"${name}" の本体がまだアップロードされていない。`,
              }))
              // ThreadNotFound などを「未アップロード」と言うと、モデルが
              // 既にあるファイルの再アップロードをユーザーに指示してしまう
              .otherwise(() => ({
                error: `"${name}" を読めなかった。会話の状態を確認すること。`,
              })),
        );
      },
    }),
  };
}
