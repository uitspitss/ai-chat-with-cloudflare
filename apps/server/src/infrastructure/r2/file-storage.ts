import type { FileStorage } from "../../domain/ports/file-storage";

/**
 * **キーのレイアウトを決めるのはここだけ。** スレッド単位で掃けるよう
 * `threads/<threadId>/` を接頭辞にしてある。変えるならこのファイルの中で完結する
 * （ドメインもユースケースもこの形を知らない）。
 */
const keyFor = (threadId: string, attachmentId: string) => `threads/${threadId}/${attachmentId}`;
const threadPrefix = (threadId: string) => `threads/${threadId}/`;

export function createR2FileStorage(bucket: R2Bucket): FileStorage {
  return {
    keyFor,

    put: async (key, body, contentType) => {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },

    getStream: async (key) => (await bucket.get(key))?.body ?? null,

    getBytes: async (key, maxBytes) => {
      // range 付きで取ると R2 から必要分しか降りてこない。maxBytes + 1 まで読むのは、
      // 呼び出し側が「上限を超えたか」を追加の HEAD 無しで判定できるようにするため。
      const object = await bucket.get(
        key,
        maxBytes === undefined ? undefined : { range: { offset: 0, length: maxBytes + 1 } },
      );
      return object ? object.arrayBuffer() : null;
    },

    // R2 の delete は存在しないキーでも成功する（冪等）
    delete: async (key) => {
      await bucket.delete(key);
    },

    deleteByThread: async (threadId) => {
      // list は既定 1000 件で truncated を返すので、切れたら続きを取る
      const prefix = threadPrefix(threadId);
      let cursor: string | undefined;
      do {
        const listed = await bucket.list({ prefix, cursor });
        const keys = listed.objects.map((object) => object.key);
        if (keys.length > 0) await bucket.delete(keys);
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    },
  };
}
