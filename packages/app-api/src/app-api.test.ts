import { describe, expect, it } from "vitest";
import { createAppApi } from "./app-api";

type Call = { url: string; init?: RequestInit };

/**
 * `fetch` を差し替えて検証する。Hono RPC クライアントごと通すので、
 * 「どのパスに何を投げるか」という**結線**まで固定できる。
 */
function stubFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const call = { url, init };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const thread = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "u1",
  title: "テスト",
  createdAt: 1,
  updatedAt: 1,
};

const fileMeta = {
  id: "22222222-2222-4222-8222-222222222222",
  threadId: thread.id,
  userId: "u1",
  name: "メモ.txt",
  size: 3,
  contentType: "text/plain",
  createdAt: 1,
};

describe("createAppApi", () => {
  it("スレッド一覧を取得する", async () => {
    const { impl, calls } = stubFetch(() => json([thread]));
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    expect(await api.listThreads()).toEqual([thread]);
    expect(calls[0]?.url).toBe("/api/threads");
  });

  it("スレッドを作成する", async () => {
    const { impl, calls } = stubFetch(() => json(thread, 201));
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    expect(await api.createThread("テスト")).toEqual(thread);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ title: "テスト" });
  });

  it("スレッドを削除する", async () => {
    const { impl, calls } = stubFetch(() => json(thread));
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    await api.deleteThread(thread.id);
    expect(calls[0]?.init?.method).toBe("DELETE");
    expect(calls[0]?.url).toBe(`/api/threads/${thread.id}`);
  });

  it("添付一覧を取得する", async () => {
    const { impl, calls } = stubFetch(() => json([fileMeta]));
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    expect(await api.listFiles(thread.id)).toEqual([fileMeta]);
    expect(calls[0]?.url).toBe(`/api/files?threadId=${thread.id}`);
  });

  it("アップロード URL を発行してからその URL に PUT する", async () => {
    const { impl, calls } = stubFetch((call) =>
      call.url.endsWith("/upload-url")
        ? json(
            {
              fileId: fileMeta.id,
              uploadUrl: `/api/files/${fileMeta.id}/content`,
              method: "PUT",
            },
            201,
          )
        : json(fileMeta),
    );
    const api = createAppApi({ baseUrl: "https://api.example.com", fetch: impl });

    await api.uploadFile({
      threadId: thread.id,
      name: fileMeta.name,
      size: fileMeta.size,
      contentType: fileMeta.contentType,
      body: "abc",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://api.example.com/api/files/upload-url");
    // サーバーは相対パスを返す。絶対 URL に直すのはクライアントの責務
    expect(calls[1]?.url).toBe(`https://api.example.com/api/files/${fileMeta.id}/content`);
    expect(calls[1]?.init?.method).toBe("PUT");
  });

  it("サーバーが返した理由をそのまま例外にする", async () => {
    const { impl } = stubFetch(() =>
      json({ code: "INVALID_FILE_SIZE", message: "25MB を超えている" }, 400),
    );
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    await expect(api.listThreads()).rejects.toThrow("25MB を超えている");
  });

  it("エラーが API の形でなければ既定の文言に落ちる", async () => {
    const { impl } = stubFetch(() => new Response("Bad Gateway", { status: 502 }));
    const api = createAppApi({ baseUrl: "/", fetch: impl });

    await expect(api.listThreads()).rejects.toThrow("スレッド一覧の取得に失敗した");
  });

  it("添付の中身の URL をベース URL に合わせて解決する", () => {
    const relative = createAppApi({ baseUrl: "/" });
    const absolute = createAppApi({ baseUrl: "https://api.example.com" });

    expect(relative.fileContentUrl(fileMeta.id)).toBe(`/api/files/${fileMeta.id}/content`);
    expect(absolute.fileContentUrl(fileMeta.id)).toBe(
      `https://api.example.com/api/files/${fileMeta.id}/content`,
    );
  });
});
