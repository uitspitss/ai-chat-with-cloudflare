import type { Attachment } from "../attachment";
import type { AttachmentId, ThreadId, UserId } from "../shared/id";

/**
 * **全メソッドが ownerId を要求する。** 所有者を取らない抜け道を残すと、
 * 新しいメソッドを足す人が認可を書き忘れても何のエラーも出ない。
 */
export type AttachmentRepository = {
  listByThread(threadId: ThreadId, ownerId: UserId): Promise<Attachment[]>;
  findById(id: AttachmentId, ownerId: UserId): Promise<Attachment | null>;
  save(attachment: Attachment): Promise<Attachment>;
  /** 本体が入らなかった登録済み行の後始末に使う。該当なしは null。 */
  deleteById(id: AttachmentId, ownerId: UserId): Promise<Attachment | null>;
};
