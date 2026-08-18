import { expect, test } from "@playwright/test";
import { attachFile, createThread } from "./fixtures";

test("ファイルを添付すると一覧に出て、本文をダウンロードできる", async ({ page, request }) => {
  const thread = await createThread(request, "添付のテスト");
  await page.goto(`/threads/${thread.id}`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("E2E からアップロードした本文", "utf-8"),
  });

  const link = page.getByRole("link", { name: /notes\.txt/ });
  await expect(link).toBeVisible();

  // 本体が R2 に入っていることを、配信経路まで通して確かめる
  const href = await link.getAttribute("href");
  const content = await request.get(href ?? "");
  expect(content.ok()).toBe(true);
  expect(await content.text()).toBe("E2E からアップロードした本文");
});

test("ダウンロード名の filename* は RFC 5987 形式になる", async ({ request }) => {
  const thread = await createThread(request, "ファイル名のエンコード");
  const file = await attachFile(request, thread.id, {
    name: "日本語(')*.txt",
    contentType: "text/plain",
    body: "本文",
  });

  const content = await request.get(`/api/files/${file.id}/content`);
  expect(content.headers()["content-disposition"]).toBe(
    "inline; filename=\"___(')*.txt\"; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E%28%27%29%2A.txt",
  );
});

test("他人のスレッドの添付は見えない", async ({ request, browser, baseURL }) => {
  const thread = await createThread(request, "覗かれない");

  // 別ユーザーを作って同じ threadId を要求する
  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const otherRequest = other.request;
  const intruder = { email: "intruder@example.test", password: "intruder-1234", name: "他人" };
  const headers = { origin: baseURL ?? "" };
  const signUp = await otherRequest.post("/api/auth/sign-up/email", { data: intruder, headers });
  // サーバーを使い回すと前回の実行のユーザーが残っているので sign-in に切り替える
  if (!signUp.ok()) {
    const signIn = await otherRequest.post("/api/auth/sign-in/email", {
      data: { email: intruder.email, password: intruder.password },
      headers,
    });
    expect(signIn.ok()).toBe(true);
  }

  const res = await otherRequest.get(`/api/files?threadId=${thread.id}`);
  expect(res.status()).toBe(404);

  await other.close();
});

test("不正な形式の ID は 400 で弾かれる（500 にしない）", async ({ request }) => {
  expect((await request.get("/api/files/not-a-uuid")).status()).toBe(400);
  expect((await request.get("/api/files?threadId=abc")).status()).toBe(400);
  expect((await request.delete("/api/threads/abc")).status()).toBe(400);
});

test("空タイトルのスレッドは 400 で弾かれる", async ({ request }) => {
  const res = await request.post("/api/threads", { data: { title: "   " } });
  expect(res.status()).toBe(400);
});

test("上限を超えるファイルは理由が画面に出る", async ({ page, request }) => {
  const thread = await createThread(request, "大きすぎる添付");
  await page.goto(`/threads/${thread.id}`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "huge.bin",
    mimeType: "application/octet-stream",
    // 上限は 25MB。境界の 1 バイト上で弾かれることを確かめる
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });

  // 「アップロードに失敗した」ではなく、サーバーが返した理由が出ること
  await expect(page.getByText(/ファイルサイズは/)).toBeVisible();
});

test("エラーレスポンスは code を含む（クライアントが分岐できる）", async ({ request }) => {
  const res = await request.post("/api/threads", { data: { title: "x".repeat(300) } });

  expect(res.status()).toBe(400);
  expect(await res.json()).toMatchObject({
    code: "INVALID_TITLE",
    message: expect.any(String),
  });
});

test("小さい size を申告して大きい本文を送っても保存されない（上限の迂回）", async ({
  request,
}) => {
  const thread = await createThread(request, "上限の迂回");

  // 10 バイトと申告して upload-url を取る
  const urlRes = await request.post("/api/files/upload-url", {
    data: {
      threadId: thread.id,
      name: "liar.bin",
      size: 10,
      contentType: "application/octet-stream",
    },
  });
  expect(urlRes.ok()).toBe(true);
  const { uploadUrl } = (await urlRes.json()) as { uploadUrl: string };

  // 実際には 1MB 送る
  const put = await request.put(uploadUrl, {
    data: Buffer.alloc(1024 * 1024),
    headers: { "content-type": "application/octet-stream" },
  });

  expect(put.status()).toBe(413);
  expect(await put.json()).toMatchObject({ code: "CONTENT_TOO_LARGE" });
});

test("スレッドを削除すると添付の本体も消える（R2 のリークを残さない）", async ({ request }) => {
  const thread = await createThread(request, "削除で本体も消す");
  const file = await attachFile(request, thread.id, {
    name: "bye.txt",
    contentType: "text/plain",
    body: "消える予定",
  });

  // 消す前は本体が取れる
  expect((await request.get(`/api/files/${file.id}/content`)).ok()).toBe(true);

  expect((await request.delete(`/api/threads/${thread.id}`)).ok()).toBe(true);

  // メタデータごと消えるので 404。本体が残っていないことは server の単体テストで確認
  expect((await request.get(`/api/files/${file.id}/content`)).status()).toBe(404);
});

/**
 * upload-url を取ったあとボディ無しで PUT した場合。早期 return で 400 を返すと
 * D1 のメタデータ行だけが残り、一覧に出るのにダウンロードは 404 になる。
 */
test("ボディ無しの PUT でも登録済みの行を残さない", async ({ request }) => {
  const thread = await createThread(request, "空ボディの後始末");

  const urlRes = await request.post("/api/files/upload-url", {
    data: { threadId: thread.id, name: "empty.txt", size: 10, contentType: "text/plain" },
  });
  const { uploadUrl } = (await urlRes.json()) as { uploadUrl: string };

  expect((await request.put(uploadUrl, { data: "" })).ok()).toBe(false);

  // 一覧にも残っていないこと
  const listed = await request.get(`/api/files?threadId=${thread.id}`);
  expect(await listed.json()).toEqual([]);
});

test("単独サロゲートを含むファイル名は登録時に弾く（取得時 500 にしない）", async ({ request }) => {
  const thread = await createThread(request, "不正なファイル名");

  const res = await request.post("/api/files/upload-url", {
    data: {
      threadId: thread.id,
      name: "bad\uD800.txt",
      size: 3,
      contentType: "text/plain",
    },
  });

  expect(res.status()).toBe(400);
});
