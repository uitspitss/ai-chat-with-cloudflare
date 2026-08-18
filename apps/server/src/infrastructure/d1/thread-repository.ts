import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { ThreadRepository } from "../../domain/ports/thread-repository";
import type { ThreadId, UserId } from "../../domain/shared/id";
import { Thread, type Title } from "../../domain/thread";
import { threads } from "./schema";

/**
 * DB の行 → ドメイン。`reconstitute` は検証しない（書き込み時に `create` を
 * 通っているので冗長で、将来ルールを厳しくしたとき既存行が読めなくなる罠を避ける）。
 * 検査するのは信頼境界（HTTP 入力とエンティティ生成）だけ。
 */
const toThread = (row: typeof threads.$inferSelect): Thread =>
  Thread.reconstitute({
    id: row.id as ThreadId,
    ownerId: row.userId as UserId,
    title: row.title as Title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

const toRow = (thread: Thread): typeof threads.$inferInsert => ({
  id: thread.id,
  userId: thread.ownerId,
  title: thread.title,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
});

export function createD1ThreadRepository(db: DrizzleD1Database): ThreadRepository {
  return {
    listByOwner: async (ownerId) =>
      (
        await db
          .select()
          .from(threads)
          .where(eq(threads.userId, ownerId))
          .orderBy(desc(threads.updatedAt))
          .all()
      ).map(toThread),

    findById: async (id, ownerId) => {
      // Drizzle の `.get()` は該当なしで undefined を返すのでここで null に正規化する
      const row = await db
        .select()
        .from(threads)
        .where(and(eq(threads.id, id), eq(threads.userId, ownerId)))
        .get();
      return row ? toThread(row) : null;
    },

    save: async (thread) =>
      toThread(
        await db
          .insert(threads)
          .values(toRow(thread))
          .onConflictDoUpdate({
            target: threads.id,
            set: { title: thread.title, updatedAt: thread.updatedAt },
          })
          .returning()
          .get(),
      ),

    deleteById: async (id, ownerId) => {
      const row = await db
        .delete(threads)
        .where(and(eq(threads.id, id), eq(threads.userId, ownerId)))
        .returning()
        .get();
      return row ? toThread(row) : null;
    },

    findOwnerId: async (id) => {
      const row = await db
        .select({ userId: threads.userId })
        .from(threads)
        .where(eq(threads.id, id))
        .get();
      return row ? (row.userId as UserId) : null;
    },
  };
}
