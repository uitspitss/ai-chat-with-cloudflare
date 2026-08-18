import { z } from "zod";

/**
 * ID の値オブジェクト。zod の `.brand()` を使うのは、**キャストではなく
 * 検査付きコンストラクタになる**ため。`as ThreadId` は嘘をつけるが
 * `ThreadId.parse(x)` は嘘をつけない。
 *
 * ここで zod を使うのは「ライブラリの再利用」であって、`@repo/schema`
 * （HTTP のワイヤ契約）への依存ではない。依存の向きは内向きのまま。
 *
 * 値オブジェクトをクラスにしていないのは、実体が文字列のままなら
 * DB 行・JSON との構造的互換が保たれ、境界での wrap/unwrap が不要なため。
 * 「検査付きコンストラクタ」という値オブジェクトの本質は `.parse` が担っている。
 */

export const ThreadId = z.uuid().brand<"ThreadId">();
export type ThreadId = z.infer<typeof ThreadId>;

export const AttachmentId = z.uuid().brand<"AttachmentId">();
export type AttachmentId = z.infer<typeof AttachmentId>;

// Better Auth が採番するのは uuid ではない（nanoid 系）ので形は縛らない
export const UserId = z.string().min(1).brand<"UserId">();
export type UserId = z.infer<typeof UserId>;

export const newThreadId = (): ThreadId => ThreadId.parse(crypto.randomUUID());
export const newAttachmentId = (): AttachmentId => AttachmentId.parse(crypto.randomUUID());
