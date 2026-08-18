import { type Result, err, ok } from "neverthrow";
import type { AppError } from "../domain/errors";
import type { AttachmentRepository } from "../domain/ports/attachment-repository";
import type { ConversationStore } from "../domain/ports/conversation-store";
import type { FileStorage } from "../domain/ports/file-storage";
import type { ThreadRepository } from "../domain/ports/thread-repository";
import type { ThreadId, UserId } from "../domain/shared/id";
import { Thread } from "../domain/thread";

/** Application Service。port だけを知り、Drizzle も Hono も知らない。 */
export function createThreadService(
  repo: ThreadRepository,
  attachments: AttachmentRepository,
  storage: FileStorage,
  conversations: ConversationStore,
) {
  return {
    list: (ownerId: UserId): Promise<Thread[]> => repo.listByOwner(ownerId),

    // async にしないと Thread.create の同期 throw が Promise の外に飛び、
    // 呼び出し側の .catch() をすり抜ける
    create: async (
      ownerId: UserId,
      input: { title: string },
      now = Date.now(),
    ): Promise<Result<Thread, AppError>> => {
      const thread = Thread.create({ ownerId, title: input.title, now });
      if (thread.isErr()) return err(thread.error);
      return ok(await repo.save(thread.value));
    },

    /**
     * スレッドと、その添付の本体、そして会話履歴まで消す。
     *
     * D1 の FK cascade が消すのは `files` の**メタデータ行だけ**で、R2 の
     * オブジェクトは残る。会話履歴に至っては D1 に無く、ChatAgent（DO）内蔵の
     * SQLite にある。どちらも放置すると削除のたびに参照不能なデータが積もる。
     *
     * 集約もストアも分かれているので 1 トランザクションにはできない。
     *
     * **本体の一掃を D1 の行の前後 2 回行う。** 冗長に見えるが役割が違う。
     *
     * - 前: ここで失敗したら D1 の行が残るので、利用者から見て「消えていない」=
     *   **再試行できる**状態に倒れる。行を先に消すと、R2 の一時的な失敗が
     *   そのまま永久の孤児になる（再試行してもスレッドがもう無い）
     * - 後: 行が消えれば `ownsThread` が通らなくなり新規登録の扉が閉まる。
     *   前の一掃と行削除の隙間に滑り込んだアップロードをここで回収する
     *
     * 一度「後ろの 1 回で足りる」と削ったが、それは再試行性を落とす変更だった。
     * `deleteByThread` は冪等なので 2 回呼んで困ることはない。
     */
    remove: async (id: ThreadId, ownerId: UserId): Promise<Result<Thread, AppError>> => {
      const found = await repo.findById(id, ownerId);
      if (!found) return err({ type: "ThreadNotFound" });

      await storage.deleteByThread(id);
      await conversations.destroy(id);

      const removed = await repo.deleteById(id, ownerId);
      if (!removed) return err({ type: "ThreadNotFound" });

      await storage.deleteByThread(id);
      return ok(removed);
    },

    /** エージェントが自インスタンス（= threadId）から所有者を復元するため。 */
    ownerOf: (id: ThreadId): Promise<UserId | null> => repo.findOwnerId(id),
  };
}
