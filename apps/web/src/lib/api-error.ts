import { apiErrorSchema } from "@repo/schema";

/**
 * サーバーが返した理由をそのまま使う。**汎用文言で握り潰さない。**
 * 25MB 超のファイルを添付したユーザーに「アップロードに失敗した」としか
 * 出ないのは、サーバーが InvalidFileSize と分かっているのに捨てているため。
 *
 * 引数は `Response` ではなく構造で受ける。Hono RPC が返すのは `ClientResponse` で、
 * `Response`（この tsconfig では Workers 版）とは別型のため。
 *
 * zValidator が弾いた 400 はこの形ではない（zod の SafeParseError がそのまま返る）ので、
 * その場合は fallback に落ちる。
 */
export async function apiError(
  res: { json: () => Promise<unknown> },
  fallback: string,
): Promise<Error> {
  try {
    const parsed = apiErrorSchema.safeParse(await res.json());
    if (parsed.success) return new Error(parsed.data.message);
  } catch {
    // JSON でない（502 など）ときは fallback に落とす
  }
  return new Error(fallback);
}
