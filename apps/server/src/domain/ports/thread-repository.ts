import type { Thread } from "../thread";
import type { ThreadId, UserId } from "../shared/id";

/**
 * 永続化の port（driven port）。**実装から推論しない**（手書きする）。
 * infrastructure/d1 の adapter がこの形を満たしに行くことで、依存が内向きに反転する。
 */
export type ThreadRepository = {
  listByOwner(ownerId: UserId): Promise<Thread[]>;
  findById(id: ThreadId, ownerId: UserId): Promise<Thread | null>;
  save(thread: Thread): Promise<Thread>;
  deleteById(id: ThreadId, ownerId: UserId): Promise<Thread | null>;
  /**
   * 所有者だけを引く。エージェント（WebSocket）は接続時に所有者確認済みで、
   * インスタンス名 = threadId しか持たないため、そこから ownerId を復元する用。
   */
  findOwnerId(id: ThreadId): Promise<UserId | null>;
};
