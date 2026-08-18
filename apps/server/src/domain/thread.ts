import { type Result, err, ok } from "neverthrow";
import { z } from "zod";
import { type DomainError, invalidTitle } from "./errors";
import { type ThreadId, type UserId, newThreadId } from "./shared/id";

/**
 * 集約ルート。Attachment とは **ID 参照** で繋がる（別の集約）。
 * 束ねていないのは、両者にまたがってトランザクションで守るべき不変条件が
 * 現時点で存在しないため。「1 スレッド合計 N MB まで」のような兄弟全体を
 * 見ないと判定できないルールが入った時点で、初めて Thread がルートになる。
 *
 * 外側（Drizzle / Hono / R2 / @repo/schema）に依存しない。
 */

const titleSchema = z.string().trim().min(1).max(200).brand<"Title">();
export type Title = z.infer<typeof titleSchema>;

export class Thread {
  /**
   * 生成経路を 2 つの静的メソッドに限定する。
   * `new Thread(...)` を外から呼べると不変条件を迂回できてしまう。
   */
  private constructor(
    readonly id: ThreadId,
    readonly ownerId: UserId,
    readonly title: Title,
    readonly createdAt: number,
    readonly updatedAt: number,
  ) {}

  /** 新規作成。不変条件（id の採番、createdAt === updatedAt、タイトル）はここが持つ。 */
  static create(params: {
    ownerId: UserId;
    title: string;
    now: number;
  }): Result<Thread, DomainError> {
    const title = titleSchema.safeParse(params.title);
    if (!title.success) {
      return err(invalidTitle("タイトルは 1〜200 文字にすること"));
    }

    return ok(new Thread(newThreadId(), params.ownerId, title.data, params.now, params.now));
  }

  /**
   * 永続化からの復元。**検証しない**のが `create` との違い。
   * 書き込み時に `create` を通っているので再検査は冗長で、かつ将来ルールを
   * 厳しくしたときに既存行が読めなくなる罠を避ける。
   *
   * 呼んでよいのは **repository とテストの fixture だけ**。検証を飛ばすので、
   * `create` なら作れない状態のエンティティを作れてしまう。fixture でそれをやると
   * **テストは通るのに現実には存在しない前提**を検証することになる
   * （実例: 採番規則と違う storageKey を持たせて、一掃のテストが意味を失った）。
   */
  static reconstitute(params: {
    id: ThreadId;
    ownerId: UserId;
    title: Title;
    createdAt: number;
    updatedAt: number;
  }): Thread {
    return new Thread(params.id, params.ownerId, params.title, params.createdAt, params.updatedAt);
  }

  /** エンティティなので同一性は id で決まる（値の一致ではない）。 */
  equals(other: Thread): boolean {
    return this.id === other.id;
  }
}
