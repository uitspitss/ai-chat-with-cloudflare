import { createApiClient, resolveApiUrl } from "@repo/api-client";
import type { FileMeta, Thread } from "@repo/schema";
import { apiError } from "./error";

export type AppApiOptions = {
  /** web は "/"、Expo は絶対 URL。相対パスの解決にも使う。 */
  baseUrl: string;
  /**
   * 認証情報の載せ方を差し替える口。
   *
   * web は既定（`credentials: "include"` で cookie が自動で載る）。
   * ネイティブは cookie jar が当てにならないので、`Cookie` ヘッダを自前で付ける
   * 実装を渡す。**認証の差はここ 1 箇所に閉じる。**
   */
  fetch?: typeof fetch;
};

export type UploadAttachmentInput = {
  threadId: string;
  name: string;
  size: number;
  contentType: string;
  /** PUT にそのまま載せる中身。web は File、ネイティブは Blob。 */
  body: BodyInit;
};

/**
 * web と mobile が共有する API 呼び出し。**TanStack Query には依存しない**素の
 * async 関数として提供し、キャッシュの組み立ては各アプリに任せる。
 *
 * 名前は CONTEXT.md の語彙（**Attachment**）に合わせる。URL が `/api/files` なのは
 * 既存のワイヤ契約なのでそのままだが、**呼ぶ側に "file" という語を広げない。**
 */
export function createAppApi({ baseUrl, fetch: fetchImpl }: AppApiOptions) {
  const httpFetch: typeof fetch =
    fetchImpl ?? ((input, init) => fetch(input, { ...init, credentials: "include" }));
  const api = createApiClient(baseUrl, httpFetch);

  return {
    async listThreads(): Promise<Thread[]> {
      const res = await api.api.threads.$get();
      if (!res.ok) throw await apiError(res, "スレッド一覧の取得に失敗した");
      return res.json();
    },

    async createThread(title: string): Promise<Thread> {
      const res = await api.api.threads.$post({ json: { title } });
      if (!res.ok) throw await apiError(res, "スレッドの作成に失敗した");
      return res.json();
    },

    async deleteThread(id: string): Promise<void> {
      const res = await api.api.threads[":id"].$delete({ param: { id } });
      if (!res.ok) throw await apiError(res, "スレッドの削除に失敗した");
    },

    async listAttachments(threadId: string): Promise<FileMeta[]> {
      const res = await api.api.files.$get({ query: { threadId } });
      if (!res.ok) throw await apiError(res, "添付ファイルの取得に失敗した");
      return res.json();
    },

    /**
     * アップロード URL を発行 → その URL に PUT。本体は API サーバー経由で R2 に入る。
     * presigned URL 方式に差し替えてもこの手順は変わらない。
     */
    async uploadAttachment(input: UploadAttachmentInput): Promise<void> {
      const urlRes = await api.api.files["upload-url"].$post({
        json: {
          threadId: input.threadId,
          name: input.name,
          size: input.size,
          contentType: input.contentType,
        },
      });
      if (!urlRes.ok) throw await apiError(urlRes, "アップロード URL の発行に失敗した");
      const { uploadUrl } = await urlRes.json();

      const putRes = await httpFetch(resolveApiUrl(baseUrl, uploadUrl), {
        method: "PUT",
        body: input.body,
        headers: { "content-type": input.contentType },
      });
      if (!putRes.ok) throw await apiError(putRes, "アップロードに失敗した");
    },

    /** 添付の中身を直接開く URL。web はリンク、ネイティブはブラウザで開く。 */
    attachmentContentUrl(attachmentId: string): string {
      return resolveApiUrl(baseUrl, `/api/files/${attachmentId}/content`);
    },
  };
}
