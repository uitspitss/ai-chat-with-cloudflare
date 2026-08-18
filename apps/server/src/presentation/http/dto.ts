import type { FileMeta, Thread as ThreadDto } from "@repo/schema";
import type { Attachment } from "../../domain/attachment";
import type { Thread } from "../../domain/thread";

/**
 * ドメイン → HTTP のワイヤ形式。`@repo/schema` はクライアントとの契約であって
 * ドメインの語彙ではないので、変換をここに閉じ込める。
 * branded 型もここで素の string / number に戻る。
 */

export const toThreadDto = (thread: Thread): ThreadDto => ({
  id: thread.id,
  userId: thread.ownerId,
  title: thread.title,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
});

/** storageKey は保存先の内部事情なのでクライアントには出さない。 */
export const toFileDto = (attachment: Attachment): FileMeta => ({
  id: attachment.id,
  threadId: attachment.threadId,
  userId: attachment.ownerId,
  name: attachment.name,
  size: attachment.size,
  contentType: attachment.contentType,
  createdAt: attachment.createdAt,
});
