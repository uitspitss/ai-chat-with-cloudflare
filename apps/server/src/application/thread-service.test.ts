import { describe, expect, it, vi } from "vitest";
import { AttachmentId } from "../domain/shared/id";
import { Thread, type Title } from "../domain/thread";
import {
  attachment,
  attachmentRepoStub,
  memoryConversations,
  memoryStorage,
  otherId,
  ownerId,
  thread,
  threadId,
  threadRepoStub,
} from "./test-doubles";
import { createThreadService } from "./thread-service";

const service = (
  ...args: Partial<Parameters<typeof createThreadService>>
): ReturnType<typeof createThreadService> =>
  createThreadService(
    args[0] ?? threadRepoStub(),
    args[1] ?? attachmentRepoStub(),
    args[2] ?? memoryStorage(),
    args[3] ?? memoryConversations(),
  );

describe("createThreadService", () => {
  it("呼び出し元の ownerId と時刻を焼き込んで保存する", async () => {
    const repo = threadRepoStub();

    const created = await service(repo).create(ownerId, { title: "hello" }, 42);

    expect(created.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId,
        title: "hello",
        createdAt: 42,
        updatedAt: 42,
      }),
    );
  });

  it("タイトルの前後空白を落としてから保存する（Title の不変条件）", async () => {
    const repo = threadRepoStub();

    await service(repo).create(ownerId, { title: "  hello  " }, 42);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ title: "hello" }));
  });

  it("空タイトルは例外ではなく InvalidTitle を返し、永続化まで到達しない", async () => {
    const repo = threadRepoStub();

    const created = await service(repo).create(ownerId, { title: "   " }, 42);

    expect(created._unsafeUnwrapErr()).toEqual({
      type: "InvalidTitle",
      message: expect.any(String),
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("200 文字を超えるタイトルも弾く", async () => {
    const repo = threadRepoStub();

    const created = await service(repo).create(ownerId, { title: "あ".repeat(201) }, 42);

    expect(created.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("スレッド削除時に添付の本体も R2 から消す（オブジェクトリークを残さない）", async () => {
    const storage = memoryStorage({ [attachment.storageKey]: "hello" });
    const repo = threadRepoStub();

    const removed = await service(repo, attachmentRepoStub([attachment]), storage).remove(
      threadId,
      ownerId,
    );

    expect(removed.isOk()).toBe(true);
    expect(storage.has(attachment.storageKey)).toBe(false);
    expect(repo.deleteById).toHaveBeenCalled();
  });

  it("スレッド削除時に会話履歴も破棄する（DO に履歴が残らない）", async () => {
    const conversations = memoryConversations([threadId]);

    const removed = await service(undefined, undefined, undefined, conversations).remove(
      threadId,
      ownerId,
    );

    expect(removed.isOk()).toBe(true);
    expect(conversations.has(threadId)).toBe(false);
  });

  it("本体 → 履歴 → メタデータ → 本体の順で消す", async () => {
    const order: string[] = [];
    const storage = memoryStorage({ [attachment.storageKey]: "hello" });
    const spied = {
      ...storage,
      deleteByThread: vi.fn(async () => void order.push("storage")),
    };
    const conversations = {
      destroy: vi.fn(async () => void order.push("conversation")),
    };
    const repo = threadRepoStub({
      deleteById: vi.fn(async () => {
        order.push("db");
        return thread;
      }),
    });

    await createThreadService(repo, attachmentRepoStub([attachment]), spied, conversations).remove(
      threadId,
      ownerId,
    );

    // 前の storage は再試行性のため（失敗しても行が残る）、後の storage は
    // 行削除との隙間に滑り込んだ分の回収
    expect(order).toEqual(["storage", "conversation", "db", "storage"]);
  });

  /**
   * 一覧を取った直後に登録された添付は一覧に含まれない。行から辿って消す実装だと
   * FK cascade でメタデータだけ消え、R2 のオブジェクトが誰にも辿れなくなる。
   */
  it("削除中に滑り込んだアップロードの本体も残さない", async () => {
    const storage = memoryStorage({ [attachment.storageKey]: "hello" });
    // 採番は adapter に任せる（テストが規則を書き写すと掃き漏らしを検出できない）
    const latecomer = storage.keyFor(
      threadId,
      AttachmentId.parse("018f0000-0000-7000-8000-0000000000ff"),
    );
    const repo = threadRepoStub({
      // 1 回目の一掃と D1 削除の隙間に別リクエストが本体を置いた状況
      deleteById: vi.fn(async () => {
        await storage.put(latecomer, "あとから来た", "text/plain");
        return thread;
      }),
    });

    const removed = await service(repo, attachmentRepoStub([attachment]), storage).remove(
      threadId,
      ownerId,
    );

    expect(removed.isOk()).toBe(true);
    expect(storage.has(latecomer)).toBe(false);
  });

  /**
   * R2 の一時的な失敗で永久の孤児を作らないための順序。行を先に消してしまうと、
   * 再試行しても「スレッドが無い」で弾かれ、残った本体に手が届かなくなる。
   */
  it("本体の一掃に失敗したらメタデータ行を残す（再試行できる状態に倒す）", async () => {
    const storage = memoryStorage({ [attachment.storageKey]: "hello" });
    const failing = {
      ...storage,
      deleteByThread: vi.fn(async () => {
        throw new Error("R2 unavailable");
      }),
    };
    const repo = threadRepoStub();

    await expect(
      createThreadService(
        repo,
        attachmentRepoStub([attachment]),
        failing,
        memoryConversations(),
      ).remove(threadId, ownerId),
    ).rejects.toThrow("R2 unavailable");

    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("他人のスレッドは消せず、本体にも履歴にも触らない", async () => {
    const storage = memoryStorage({ [attachment.storageKey]: "hello" });
    const conversations = memoryConversations([threadId]);
    const repo = threadRepoStub({ findById: vi.fn(async () => null) });

    const removed = await service(
      repo,
      attachmentRepoStub([attachment]),
      storage,
      conversations,
    ).remove(threadId, otherId);

    expect(removed._unsafeUnwrapErr()).toEqual({ type: "ThreadNotFound" });
    expect(storage.has(attachment.storageKey)).toBe(true);
    expect(conversations.has(threadId)).toBe(true);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("エンティティの同一性は id で決まる", () => {
    const same = Thread.reconstitute({
      id: threadId,
      ownerId: otherId,
      title: "別のタイトル" as Title,
      createdAt: 999,
      updatedAt: 999,
    });

    expect(thread.equals(same)).toBe(true);
  });

  it("ThreadId と UserId は取り違えられない（コンパイル時）", () => {
    // @ts-expect-error 第 1 引数は ThreadId。UserId は渡せない
    service().remove(ownerId, threadId);
  });
});
