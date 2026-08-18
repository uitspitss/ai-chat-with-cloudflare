import { describe, expect, it, vi } from "vitest";
import { createAttachmentService } from "./attachment-service";
import {
  attachment,
  attachmentId,
  attachmentNamed,
  attachmentRepoStub,
  memoryStorage,
  otherId,
  ownerId,
  streamOf,
  threadId,
  threadRepoStub,
} from "./test-doubles";

const input = {
  threadId,
  name: "a.txt",
  size: 3,
  contentType: "text/plain",
};

const owned = () => threadRepoStub();
const notOwned = () => threadRepoStub({ findById: async () => null });

describe("createAttachmentService", () => {
  it("自分のスレッドなら storageKey を採番して登録する", async () => {
    const repo = attachmentRepoStub();

    const storage = memoryStorage();
    const saved = await createAttachmentService(repo, owned(), storage).register(
      ownerId,
      input,
      99,
    );

    const value = saved._unsafeUnwrap();
    // **キーの形は問わない。** 採番は adapter の責務なので、ここで検証すべきは
    // 「storage に採番させたか」だけ。`threads/...` を書くと application が
    // レイアウトを知っていることになり、移した意味が無くなる
    expect(value.storageKey).toBe(storage.keyFor(threadId, value.id));
    expect(value.createdAt).toBe(99);
  });

  it("他人のスレッドには登録させない", async () => {
    const repo = attachmentRepoStub();

    const saved = await createAttachmentService(repo, notOwned(), memoryStorage()).register(
      otherId,
      input,
    );

    expect(saved._unsafeUnwrapErr()).toEqual({ type: "ThreadNotFound" });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("他人のスレッドの添付一覧は返さない", async () => {
    const repo = attachmentRepoStub();

    const found = await createAttachmentService(repo, notOwned(), memoryStorage()).listByThread(
      otherId,
      threadId,
    );

    expect(found._unsafeUnwrapErr()).toEqual({ type: "ThreadNotFound" });
    expect(repo.listByThread).not.toHaveBeenCalled();
  });

  it("上限を超えるファイルは InvalidFileSize を返す（例外にしない）", async () => {
    const repo = attachmentRepoStub();

    const saved = await createAttachmentService(repo, owned(), memoryStorage()).register(ownerId, {
      ...input,
      size: 26 * 1024 * 1024,
    });

    expect(saved._unsafeUnwrapErr()).toMatchObject({ type: "InvalidFileSize" });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("添付ファイルを名前で引いてテキストとして読める", async () => {
    const service = createAttachmentService(
      attachmentRepoStub([attachment]),
      owned(),
      memoryStorage({ [attachment.storageKey]: "hello" }),
    );

    expect((await service.readText(ownerId, threadId, "a.txt"))._unsafeUnwrap()).toEqual({
      name: "a.txt",
      truncated: false,
      content: "hello",
    });
  });

  it("readText も所有者で絞る（エージェント経路に抜け道を作らない）", async () => {
    const repo = attachmentRepoStub([attachment]);
    const service = createAttachmentService(
      repo,
      owned(),
      memoryStorage({ [attachment.storageKey]: "hello" }),
    );

    await service.readText(ownerId, threadId, "a.txt");

    expect(repo.listByThread).toHaveBeenCalledWith(threadId, ownerId);
  });

  it("添付されていない名前は AttachmentNotFound", async () => {
    const service = createAttachmentService(attachmentRepoStub([]), owned(), memoryStorage());

    expect((await service.readText(ownerId, threadId, "missing.txt"))._unsafeUnwrapErr()).toEqual({
      type: "AttachmentNotFound",
    });
  });

  it("本体が未アップロードなら ContentNotUploaded", async () => {
    const service = createAttachmentService(
      attachmentRepoStub([attachment]),
      owned(),
      memoryStorage(),
    );

    expect((await service.readText(ownerId, threadId, "a.txt"))._unsafeUnwrapErr()).toEqual({
      type: "ContentNotUploaded",
    });
  });

  it("AttachmentId と UserId は取り違えられない（コンパイル時）", () => {
    const service = createAttachmentService(attachmentRepoStub(), owned(), memoryStorage());
    // @ts-expect-error 第 1 引数は AttachmentId。UserId は渡せない
    service.findById(ownerId, attachmentId);
  });

  it("申告より大きい本文は保存されない（Content-Length で弾く）", async () => {
    const storage = memoryStorage();
    const service = createAttachmentService(attachmentRepoStub([attachment]), owned(), storage);

    // attachment の申告サイズは 5 バイト
    const uploaded = await service.uploadContent(attachmentId, ownerId, streamOf(100), 100);

    expect(uploaded._unsafeUnwrapErr()).toEqual({ type: "ContentTooLarge" });
    expect(storage.has(attachment.storageKey)).toBe(false);
  });

  it("Content-Length が無ければ受け付けない（長さが確定しないと上限を担保できない）", async () => {
    const storage = memoryStorage();
    const service = createAttachmentService(attachmentRepoStub([attachment]), owned(), storage);

    const uploaded = await service.uploadContent(attachmentId, ownerId, streamOf(100));

    expect(uploaded._unsafeUnwrapErr()).toEqual({ type: "LengthRequired" });
    expect(storage.has(attachment.storageKey)).toBe(false);
  });

  it("申告サイズ以内なら保存される", async () => {
    const storage = memoryStorage();
    const service = createAttachmentService(attachmentRepoStub([attachment]), owned(), storage);

    const uploaded = await service.uploadContent(attachmentId, ownerId, streamOf(5), 5);

    expect(uploaded.isOk()).toBe(true);
    expect(storage.sizeOf(attachment.storageKey)).toBe(5);
  });

  it("storage への保存に失敗したらメタデータ行を消して例外を再送出する", async () => {
    const repo = attachmentRepoStub([attachment]);
    const storage = memoryStorage();
    const failure = new Error("storage unavailable");
    vi.spyOn(storage, "put").mockRejectedValue(failure);
    const service = createAttachmentService(repo, owned(), storage);

    await expect(service.uploadContent(attachmentId, ownerId, streamOf(5), 5)).rejects.toBe(
      failure,
    );
    expect(repo.deleteById).toHaveBeenCalledWith(attachmentId, ownerId);
  });

  /**
   * 申告 5 バイトに対して 1 バイトしか送らないケース。訂正しないと、UI にも
   * listThreadFiles にも「5 バイト」と出続ける（クライアントの自己申告が正になる）。
   */
  it("実際に保存したバイト数で size を訂正する", async () => {
    const repo = attachmentRepoStub([attachment]);
    const service = createAttachmentService(repo, owned(), memoryStorage());

    const uploaded = await service.uploadContent(attachmentId, ownerId, streamOf(1), 1);

    expect(uploaded._unsafeUnwrap().size).toBe(1);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ size: 1 }));
  });

  it("size が変わらないなら保存し直さない", async () => {
    const repo = attachmentRepoStub([attachment]);
    const service = createAttachmentService(repo, owned(), memoryStorage());

    await service.uploadContent(attachmentId, ownerId, streamOf(5), 5);

    expect(repo.save).not.toHaveBeenCalled();
  });

  /**
   * 登録だけ済んで本体が入らなかった行を残すと、UI に 📎 リンクが出て
   * クリックすると 404、エージェントにも読めないファイルが見えてしまう。
   */
  it("アップロードが弾かれたらメタデータ行を消す（孤児を残さない）", async () => {
    const repo = attachmentRepoStub([attachment]);
    const service = createAttachmentService(repo, owned(), memoryStorage());

    await service.uploadContent(attachmentId, ownerId, streamOf(100), 100);

    expect(repo.deleteById).toHaveBeenCalledWith(attachmentId, ownerId);
  });

  /**
   * register は size >= 1 しか通さないので、空ファイルはそもそも登録できない。
   * `> size` の判定は 0 を素通りさせるため、保存**前**に弾かないと
   * 「R2 に空オブジェクトを置いてから 400 を返す」経路ができる。
   */
  it("Content-Length: 0 は保存前に弾いて後始末する", async () => {
    const repo = attachmentRepoStub([attachment]);
    const storage = memoryStorage();
    const service = createAttachmentService(repo, owned(), storage);

    const uploaded = await service.uploadContent(attachmentId, ownerId, streamOf(0), 0);

    expect(uploaded._unsafeUnwrapErr()).toMatchObject({ type: "InvalidFileSize" });
    expect(storage.has(attachment.storageKey)).toBe(false);
    expect(repo.deleteById).toHaveBeenCalledWith(attachmentId, ownerId);
  });

  it("他人の添付なら消しにも行かない", async () => {
    const repo = attachmentRepoStub([]);
    const service = createAttachmentService(repo, notOwned(), memoryStorage());

    await service.uploadContent(attachmentId, otherId, streamOf(100), 100);

    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  /**
   * 同名の再アップロードは「差し替えたつもり」なので、古い方を読ませると
   * エージェントが黙って古い内容で答える。
   */
  it("同名のファイルが複数あるときは新しい方を読む", async () => {
    const old = attachmentNamed({
      name: "notes.md",
      id: "018f0000-0000-7000-8000-0000000000a1",
      storageKey: "threads/t1/old",
      createdAt: 1,
    });
    const fresh = attachmentNamed({
      name: "notes.md",
      id: "018f0000-0000-7000-8000-0000000000a2",
      storageKey: "threads/t1/new",
      createdAt: 2,
    });
    const service = createAttachmentService(
      // createdAt 昇順（D1 のリポジトリと同じ並び）
      attachmentRepoStub([old, fresh]),
      owned(),
      memoryStorage({ "threads/t1/old": "ふるい", "threads/t1/new": "あたらしい" }),
    );

    const read = await service.readText(ownerId, threadId, "notes.md");

    expect(read._unsafeUnwrap().content).toBe("あたらしい");
  });
});
