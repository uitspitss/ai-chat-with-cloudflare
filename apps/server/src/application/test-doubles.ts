import { vi } from "vitest";
import { Attachment, type ContentType, type FileSize } from "../domain/attachment";
import type { AttachmentRepository } from "../domain/ports/attachment-repository";
import type { ConversationStore } from "../domain/ports/conversation-store";
import type { FileStorage } from "../domain/ports/file-storage";
import type { ThreadRepository } from "../domain/ports/thread-repository";
import { AttachmentId, ThreadId, UserId } from "../domain/shared/id";
import { Thread, type Title } from "../domain/thread";

/**
 * Application Service のテスト用ダブル。
 * port が手書きなので**キャスト無しで型検査される** — メソッドを
 * 足し忘れるとここがコンパイルエラーになる（`as unknown as` で黙らせないこと）。
 */

export const ownerId = UserId.parse("u1");
export const otherId = UserId.parse("u2");
export const threadId = ThreadId.parse("018f0000-0000-7000-8000-000000000000");
export const attachmentId = AttachmentId.parse("018f0000-0000-7000-8000-0000000000f1");

export const thread = Thread.reconstitute({
  id: threadId,
  ownerId,
  title: "hello" as Title,
  createdAt: 1,
  updatedAt: 1,
});

/**
 * インメモリ adapter の採番。**R2 の形を真似る必要はない**（storageKey は
 * 呼び出し側から見て不透明）。スレッド単位で掃けることだけが要件。
 */
const memoryKeyPrefix = (threadId: string) => `mem:${threadId}/`;
const memoryKeyFor = (threadId: string, attachmentId: string) =>
  `${memoryKeyPrefix(threadId)}${attachmentId}`;

export const attachment = Attachment.reconstitute({
  id: attachmentId,
  threadId,
  ownerId,
  name: "a.txt",
  size: 5 as FileSize,
  contentType: "text/plain" as ContentType,
  // adapter に採番させる。手で書くと deleteByThread の掃き漏らしを検出できなくなる
  storageKey: memoryKeyFor(threadId, attachmentId),
  createdAt: 1,
});

export function threadRepoStub(overrides: Partial<ThreadRepository> = {}): ThreadRepository {
  return {
    listByOwner: vi.fn(async () => [thread]),
    findById: vi.fn(async () => thread),
    save: vi.fn(async (t) => t),
    deleteById: vi.fn(async () => thread),
    findOwnerId: vi.fn(async () => ownerId),
    ...overrides,
  };
}

export function attachmentRepoStub(rows: Attachment[] = []): AttachmentRepository {
  return {
    listByThread: vi.fn(async () => rows),
    findById: vi.fn(async () => rows[0] ?? null),
    save: vi.fn(async (a) => a),
    deleteById: vi.fn(async () => rows[0] ?? null),
  };
}

/** 同名・別 createdAt の添付を作る（重複名の解決を検証する用）。 */
export function attachmentNamed(params: {
  name: string;
  id: string;
  storageKey: string;
  createdAt: number;
}): Attachment {
  return Attachment.reconstitute({
    id: AttachmentId.parse(params.id),
    threadId,
    ownerId,
    name: params.name,
    size: 5 as FileSize,
    contentType: "text/plain" as ContentType,
    storageKey: params.storageKey,
    createdAt: params.createdAt,
  });
}

/** ConversationStore も同様に、DO を起こさず「消したか」だけ検証できる。 */
export function memoryConversations(seed: ThreadId[] = [threadId]) {
  const live = new Set<string>(seed);

  const store: ConversationStore = {
    destroy: vi.fn(async (id: ThreadId) => {
      live.delete(id);
    }),
  };

  return Object.assign(store, { has: (id: ThreadId) => live.has(id) });
}

/** FileStorage を port にしたので、R2 を触らず読み書きまで検証できる。 */
export function memoryStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, ArrayBuffer>(
    Object.entries(seed).map(([k, v]) => [k, new TextEncoder().encode(v).buffer as ArrayBuffer]),
  );

  const storage: FileStorage = {
    keyFor: memoryKeyFor,

    put: async (key, body) => {
      if (body instanceof ReadableStream) {
        const chunks: Uint8Array[] = [];
        const reader = body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let at = 0;
        for (const c of chunks) {
          merged.set(c, at);
          at += c.byteLength;
        }
        store.set(key, merged.buffer as ArrayBuffer);
        return;
      }
      store.set(key, new TextEncoder().encode(String(body)).buffer as ArrayBuffer);
    },
    getStream: async (key) => (store.has(key) ? new ReadableStream() : null),
    // range を無視すると「全読みしている実装」もテストを通ってしまうので、
    // インメモリ側も maxBytes + 1 までしか返さない（R2 の adapter と同じ挙動）
    getBytes: async (key, maxBytes) => {
      const bytes = store.get(key);
      if (!bytes) return null;
      return maxBytes === undefined ? bytes : bytes.slice(0, maxBytes + 1);
    },
    delete: async (key) => {
      store.delete(key);
    },
    deleteByThread: async (threadId) => {
      for (const key of [...store.keys()]) {
        if (key.startsWith(memoryKeyPrefix(threadId))) store.delete(key);
      }
    },
  };

  return Object.assign(storage, {
    has: (key: string) => store.has(key),
    sizeOf: (key: string) => store.get(key)?.byteLength ?? 0,
  });
}

/** 指定バイト数を 1 チャンクで流すストリーム。 */
export function streamOf(bytes: number): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}
