import { type Result, err, ok } from "neverthrow";
import { z } from "zod";
import { type DomainError, invalidContentType, invalidFileSize } from "./errors";
import type { AttachmentId, ThreadId, UserId } from "./shared/id";

/**
 * 集約ルート。所属スレッドは `threadId` の **ID 参照** で持ち、Thread の
 * オブジェクトグラフには入らない（理由は domain/thread.ts のコメント）。
 * 単体でアドレスされる経路（GET/PUT /api/files/:id）があるのもこのため。
 */

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const fileSizeSchema = z.number().int().positive().max(MAX_FILE_BYTES).brand<"FileSize">();
export type FileSize = z.infer<typeof fileSizeSchema>;

/**
 * RFC 7231 の media-type（`type/subtype` + 任意のパラメータ）。
 *
 * **長さだけの検証では足りない。** この値は `GET /api/files/:id/content` の
 * `content-type` ヘッダにそのまま入るので、CRLF を含む値を登録できると
 * `new Response()` が `invalid header value` で throw し、**その添付は永久に 500**
 * になる（API 経由で content-type を直す手段が無い）。入口で弾く。
 */
const MEDIA_TYPE = /^[\w.+-]+\/[\w.+-]+(?:\s*;\s*[\w.+-]+=(?:"[^"]*"|[\w.+-]+))*$/;

/**
 * ヘッダ値は **ByteString**（1 文字 1 バイト）。`"😀"` のように quoted parameter へ
 * 入れれば正規表現は通ってしまうため、範囲でも弾く。制御文字（CRLF 含む）と
 * 0x7e 超を落とせば、印字可能 ASCII だけが残る。
 */
const isHeaderSafe = (value: string) =>
  [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e;
  });

const contentTypeSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(MEDIA_TYPE)
  .refine(isHeaderSafe)
  .brand<"ContentType">();
export type ContentType = z.infer<typeof contentTypeSchema>;

/** モデルに流し込むテキストの上限。バイナリや巨大ファイルで詰まらせない。 */
export const MAX_TEXT_BYTES = 32 * 1024;

export class Attachment {
  private constructor(
    readonly id: AttachmentId,
    readonly threadId: ThreadId,
    readonly ownerId: UserId,
    readonly name: string,
    readonly size: FileSize,
    readonly contentType: ContentType,
    /** 保存先を指す不透明なキー。R2 の語彙ではない（読み替えは infrastructure/r2）。 */
    readonly storageKey: string,
    readonly createdAt: number,
  ) {}

  /**
   * `id` と `storageKey` は**呼び出し側が渡す**。保存先のレイアウトは infrastructure の
   * 都合なので、ドメインが `threads/...` を組み立てない（FileStorage.keyFor が決める）。
   */
  static create(params: {
    id: AttachmentId;
    threadId: ThreadId;
    ownerId: UserId;
    name: string;
    size: number;
    contentType: string;
    storageKey: string;
    now: number;
  }): Result<Attachment, DomainError> {
    const size = fileSizeSchema.safeParse(params.size);
    if (!size.success) {
      return err(invalidFileSize(`ファイルサイズは 1〜${MAX_FILE_BYTES} バイト`));
    }

    const contentType = contentTypeSchema.safeParse(params.contentType);
    if (!contentType.success) {
      return err(invalidContentType("content-type が不正"));
    }

    return ok(
      new Attachment(
        params.id,
        params.threadId,
        params.ownerId,
        params.name,
        size.data,
        contentType.data,
        params.storageKey,
        params.now,
      ),
    );
  }

  /**
   * 実際に保存されたバイト数で `size` を訂正した複製を返す。
   *
   * 登録時の `size` は**クライアントの自己申告**で、上限の判定にしか使っていない。
   * 申告より小さい本文は正当に受け付けるので、そのままだと嘘のサイズが残り、
   * UI にもエージェントのツールにもその値が出る。
   */
  withActualSize(bytes: number): Result<Attachment, DomainError> {
    const size = fileSizeSchema.safeParse(bytes);
    if (!size.success) {
      return err(invalidFileSize(`ファイルサイズは 1〜${MAX_FILE_BYTES} バイト`));
    }
    return ok(
      new Attachment(
        this.id,
        this.threadId,
        this.ownerId,
        this.name,
        size.data,
        this.contentType,
        this.storageKey,
        this.createdAt,
      ),
    );
  }

  /** 永続化からの復元。検証しない（呼んでよい範囲と理由は Thread.reconstitute のコメント）。 */
  static reconstitute(params: {
    id: AttachmentId;
    threadId: ThreadId;
    ownerId: UserId;
    name: string;
    size: FileSize;
    contentType: ContentType;
    storageKey: string;
    createdAt: number;
  }): Attachment {
    return new Attachment(
      params.id,
      params.threadId,
      params.ownerId,
      params.name,
      params.size,
      params.contentType,
      params.storageKey,
      params.createdAt,
    );
  }

  equals(other: Attachment): boolean {
    return this.id === other.id;
  }
}
