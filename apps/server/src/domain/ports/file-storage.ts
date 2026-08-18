import type { AttachmentId, ThreadId } from "../shared/id";

/**
 * ファイル本体の置き場を表す port。R2 でも S3 でもメモリでも成り立つ語彙にしておく
 * （テストはインメモリの adapter を差せる）。
 *
 * **キーの採番はこちら側の責務。** `storageKey` はドメインから見て不透明な値で、
 * `threads/<threadId>/<attachmentId>` のようなレイアウトは保存先の都合でしかない。
 * ドメインが組み立てると、採番を変えたときに一掃だけ古い形のまま残る事故が起きる。
 */
export type FileStorage = {
  /**
   * この添付の本体を置く場所を決める。**キーのレイアウトは実装の都合**なので、
   * ドメインにもユースケースにも `threads/...` のような形を書かせない。
   * 同じ引数には常に同じキーを返すこと（副作用を持たない）。
   */
  keyFor(threadId: ThreadId, attachmentId: AttachmentId): string;
  put(key: string, body: ReadableStream | ArrayBuffer | string, contentType: string): Promise<void>;
  /** ダウンロード配信用。存在しなければ null。 */
  getStream(key: string): Promise<ReadableStream | null>;
  /**
   * ツールがテキストとして読む用。存在しなければ null。
   *
   * `maxBytes` を渡したら**先頭のその範囲だけ**を読むこと。上限を超えたかを
   * 呼び出し側が判定できるよう、実装は `maxBytes + 1` バイトまで返してよい。
   * 全部読んでから切り詰めると、32KB を返すために最大 25MB を Durable Object の
   * メモリに載せることになる。
   */
  getBytes(key: string, maxBytes?: number): Promise<ArrayBuffer | null>;
  /** 存在しないキーを渡しても失敗しないこと（削除は冪等） */
  delete(key: string): Promise<void>;
  /**
   * そのスレッドに属する本体をまとめて消す。**該当が 0 件でも失敗しないこと。**
   *
   * スレッド削除では「メタデータ行から辿って消す」だけでは足りない。
   * 一覧を取った直後に登録された添付は一覧に入らず、FK cascade で行だけ消えて
   * 本体が残る。行を介さずスレッド単位で掃けるようにしておく。
   */
  deleteByThread(threadId: ThreadId): Promise<void>;
};
