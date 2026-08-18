import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Attachment, type ContentType, type FileSize } from "../../domain/attachment";
import type { AttachmentRepository } from "../../domain/ports/attachment-repository";
import type { AttachmentId, ThreadId, UserId } from "../../domain/shared/id";
import { files } from "./schema";

// 行 → ドメインの変換方針は thread-repository.ts のコメントを参照。
const toAttachment = (row: typeof files.$inferSelect): Attachment =>
  Attachment.reconstitute({
    id: row.id as AttachmentId,
    threadId: row.threadId as ThreadId,
    ownerId: row.userId as UserId,
    name: row.name,
    size: row.size as FileSize,
    contentType: row.contentType as ContentType,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
  });

const toRow = (a: Attachment): typeof files.$inferInsert => ({
  id: a.id,
  threadId: a.threadId,
  userId: a.ownerId,
  name: a.name,
  size: a.size,
  contentType: a.contentType,
  storageKey: a.storageKey,
  createdAt: a.createdAt,
});

export function createD1AttachmentRepository(db: DrizzleD1Database): AttachmentRepository {
  return {
    listByThread: async (threadId, ownerId) =>
      (
        await db
          .select()
          .from(files)
          .where(and(eq(files.threadId, threadId), eq(files.userId, ownerId)))
          .orderBy(asc(files.createdAt))
          .all()
      ).map(toAttachment),

    findById: async (id, ownerId) => {
      const row = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, ownerId)))
        .get();
      return row ? toAttachment(row) : null;
    },

    // アップロード後の size 訂正で既存 id を再保存するので upsert にする
    // （insert だけだと PRIMARY KEY 衝突で落ちる）。thread-repository と同じ形。
    save: async (attachment) =>
      toAttachment(
        await db
          .insert(files)
          .values(toRow(attachment))
          .onConflictDoUpdate({ target: files.id, set: { size: attachment.size } })
          .returning()
          .get(),
      ),

    deleteById: async (id, ownerId) => {
      const row = await db
        .delete(files)
        .where(and(eq(files.id, id), eq(files.userId, ownerId)))
        .returning()
        .get();
      return row ? toAttachment(row) : null;
    },
  };
}
