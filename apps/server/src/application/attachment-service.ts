import { type Result, err, ok } from "neverthrow";
import { Attachment, MAX_TEXT_BYTES } from "../domain/attachment";
import { type AppError, invalidFileSize } from "../domain/errors";
import type { AttachmentRepository } from "../domain/ports/attachment-repository";
import type { FileStorage } from "../domain/ports/file-storage";
import type { ThreadRepository } from "../domain/ports/thread-repository";
import {
  type AttachmentId,
  type ThreadId,
  type UserId,
  newAttachmentId,
} from "../domain/shared/id";

/**
 * **全メソッドが ownerId を取る。** 認可そのものは delivery 境界
 * （HTTP の requireAuth / WebSocket の onBeforeConnect）が行うが、
 * 所有者を取らないメソッドを 1 つでも残すと「呼び出し元を信じる」抜け道になり、
 * 新しい経路が増えたときに黙って認可が消える。
 */
export function createAttachmentService(
  attachments: AttachmentRepository,
  threads: ThreadRepository,
  storage: FileStorage,
) {
  const ownsThread = async (threadId: ThreadId, ownerId: UserId) =>
    (await threads.findById(threadId, ownerId)) !== null;

  const findOwned = async (
    id: AttachmentId,
    ownerId: UserId,
  ): Promise<Result<Attachment, AppError>> => {
    const found = await attachments.findById(id, ownerId);
    return found ? ok(found) : err({ type: "AttachmentNotFound" });
  };

  return {
    listByThread: async (
      ownerId: UserId,
      threadId: ThreadId,
    ): Promise<Result<Attachment[], AppError>> => {
      if (!(await ownsThread(threadId, ownerId))) {
        return err({ type: "ThreadNotFound" });
      }
      return ok(await attachments.listByThread(threadId, ownerId));
    },

    /** メタデータだけ先に登録する。本体は uploadContent が受け取る。 */
    register: async (
      ownerId: UserId,
      input: {
        threadId: ThreadId;
        name: string;
        size: number;
        contentType: string;
      },
      now = Date.now(),
    ): Promise<Result<Attachment, AppError>> => {
      if (!(await ownsThread(input.threadId, ownerId))) {
        return err({ type: "ThreadNotFound" });
      }

      // id を先に採ってから保存先を決める。**キーの形はここでは組み立てない**
      // （レイアウトは storage の都合。domain/application は不透明な値として扱う）
      const id = newAttachmentId();
      const attachment = Attachment.create({
        ...input,
        id,
        ownerId,
        storageKey: storage.keyFor(input.threadId, id),
        now,
      });
      if (attachment.isErr()) return err(attachment.error);
      return ok(await attachments.save(attachment.value));
    },

    findById: findOwned,

    /**
     * 本文を受け取って保存する。
     *
     * **申告サイズを信用しない。** register 時に検証しているのはクライアントが
     * 申告した `size` であって、実際に送られてくるバイト列ではない。小さい size を
     * 申告してから巨大な本文を PUT すれば上限を迂回できてしまう。
     *
     * 判定は `Content-Length` で行う。リクエストボディは HTTP の層でその長さに
     * 収まることが保証されるので、これで実バイト数も抑えられる。
     *
     * **ストリームを TransformStream で包んで数えてはいけない。** R2 の `put` は
     * 長さが確定したストリーム（リクエストボディか FixedLengthStream）しか受け付けず、
     * 変換を挟むと `Provided readable stream must have a known length` で落ちる。
     */
    uploadContent: async (
      id: AttachmentId,
      ownerId: UserId,
      body: ReadableStream,
      declaredLength?: number,
    ): Promise<Result<Attachment, AppError>> => {
      const found = await findOwned(id, ownerId);
      if (found.isErr()) return found;

      // 本体が入らなかった登録済み行を残すと、UI に 📎 リンクが出てクリックで 404、
      // listThreadFiles にも読めないファイルが並ぶ。所有者確認の**後**に消す。
      const discard = async <E>(error: E) => {
        await attachments.deleteById(id, ownerId);
        return err(error);
      };

      // 長さが分からないと上限を担保できないので受け付けない（chunked は非対応）
      if (declaredLength === undefined) return discard({ type: "LengthRequired" } as const);
      if (declaredLength > (found.value.size as number)) {
        return discard({ type: "ContentTooLarge" } as const);
      }
      // register は size >= 1 しか通さないので空ファイルは登録され得ない。
      // ここで弾かないと `> size` を素通りして R2 に空オブジェクトが残り、
      // その後の withActualSize(0) が失敗して 400 だけが返る（実体は残る）
      if (declaredLength < 1) {
        return discard(invalidFileSize("本文が空。1 バイト以上が必要"));
      }

      try {
        await storage.put(found.value.storageKey, body, found.value.contentType);
      } catch (error) {
        await attachments.deleteById(id, ownerId);
        throw error;
      }

      // 申告より小さい本文は正当に受け付けるので、実バイト数へ訂正する
      if (declaredLength === (found.value.size as number)) return ok(found.value);
      const corrected = found.value.withActualSize(declaredLength);
      if (corrected.isErr()) return err(corrected.error);
      return ok(await attachments.save(corrected.value));
    },

    openDownload: async (
      id: AttachmentId,
      ownerId: UserId,
    ): Promise<Result<{ attachment: Attachment; body: ReadableStream }, AppError>> => {
      const found = await findOwned(id, ownerId);
      if (found.isErr()) return err(found.error);

      const body = await storage.getStream(found.value.storageKey);
      return body ? ok({ attachment: found.value, body }) : err({ type: "ContentNotUploaded" });
    },

    /** エージェントのツール用。スレッド内のファイル名で引く。 */
    readText: async (
      ownerId: UserId,
      threadId: ThreadId,
      name: string,
    ): Promise<Result<{ name: string; truncated: boolean; content: string }, AppError>> => {
      const found = await attachments.listByThread(threadId, ownerId);
      // 同名の再アップロードは「差し替えたつもり」なので新しい方を読む。
      // listByThread は createdAt 昇順なので findLast が最新になる
      const attachment = found.findLast((a) => a.name === name);
      if (!attachment) return err({ type: "AttachmentNotFound" });

      // 32KB しか使わないので、range で先頭だけ読む（全読みすると 25MB の添付で
      // Durable Object のメモリを踏む）。+1 バイト分で切り詰めの有無が分かる。
      const bytes = await storage.getBytes(attachment.storageKey, MAX_TEXT_BYTES);
      if (!bytes) return err({ type: "ContentNotUploaded" });

      const truncated = bytes.byteLength > MAX_TEXT_BYTES;
      // 切ると UTF-8 のマルチバイト文字を途中で割りうる。stream: true にすると
      // 尻切れのシーケンスは U+FFFD にせず捨てられる。
      const content = new TextDecoder().decode(truncated ? bytes.slice(0, MAX_TEXT_BYTES) : bytes, {
        stream: truncated,
      });
      return ok({ name, truncated, content });
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
