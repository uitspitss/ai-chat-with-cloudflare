import { expect, test } from "@playwright/test";
import { attachFile, createThread } from "./fixtures";

/**
 * LLM は `E2E_FAKE_LLM=1` の決定的なダミー（playwright.config.ts で渡している）。
 * 1 ステップ目で readThreadFile を呼び、2 ステップ目で本文を返す。
 * 実物の Workers AI はリモート接続に依存するので E2E では使わない。
 */
const FAKE_ANSWER = "既知の問題は Safari でスクロール位置が復元されない点です。";

test("メッセージを送るとツールが実行され、応答が表示される", async ({ page, request }) => {
  const thread = await createThread(request, "チャットのテスト");
  await attachFile(request, thread.id, {
    name: "release-notes.md",
    contentType: "text/markdown",
    body: "## 既知の問題\n- Safari でスクロール位置が復元されない\n",
  });

  await page.goto(`/threads/${thread.id}`);
  await page.getByPlaceholder("メッセージを入力").fill("既知の問題を教えて");
  await page.getByRole("button", { name: "送信" }).click();

  // ツール呼び出しが UI に出る
  await expect(page.getByText("readThreadFile")).toBeVisible({ timeout: 30_000 });
  // ツールの結果（R2 から読んだ中身）が出る
  await expect(page.getByText(/スクロール位置が復元されない/).first()).toBeVisible();
  // 最終応答が出る
  await expect(page.getByText(FAKE_ANSWER)).toBeVisible({ timeout: 30_000 });
});

test("リロードしても会話履歴が復元される（Durable Object の永続化）", async ({ page, request }) => {
  const thread = await createThread(request, "履歴の復元");
  await attachFile(request, thread.id, {
    name: "release-notes.md",
    contentType: "text/markdown",
    body: "## 既知の問題\n- Safari でスクロール位置が復元されない\n",
  });

  await page.goto(`/threads/${thread.id}`);
  await page.getByPlaceholder("メッセージを入力").fill("既知の問題を教えて");
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.getByText(FAKE_ANSWER)).toBeVisible({ timeout: 30_000 });

  // **画面に出た = 永続化された、ではない。** UI はストリームの最終チャンクで
  // 描画されるが、DO への保存は onFinish の非同期処理。見えた瞬間にリロードすると
  // 保存が間に合わず履歴が空で復元され、遅い環境で間欠的に落ちる。
  // AIChatAgent の get-messages は `_loadMessagesFromDb()` を返すので、
  // 「保存済みか」をそのまま問い合わせられる（描画状態ではなく永続化を待つ）。
  await expect
    .poll(async () => (await request.get(`/agents/chat-agent/${thread.id}/get-messages`)).text(), {
      timeout: 30_000,
    })
    .toContain(FAKE_ANSWER);

  await page.reload();

  await expect(page.getByText("既知の問題を教えて")).toBeVisible();
  await expect(page.getByText(FAKE_ANSWER)).toBeVisible();
});

/**
 * **開いたままスレッドを削除したときの挙動はここでは固定していない。**
 *
 * 削除すると DO が破棄されて WebSocket が切れ、以降の再接続は `onBeforeConnect` が
 * 403 で拒否する。ユーザーには何も出ず、クライアントは黙って再接続を繰り返す。
 *
 * 直せていない理由: agents SDK の `connectionError` は terminal な close
 * （1008 / 4000-4999）でしか立たず、ハンドシェイク拒否で生じる 1006 では立たない
 * （`isTerminalCloseEvent`）。つまりクライアントからこの状態を検知する手段が無い。
 * 理由を画面に出すにはサーバーが 4xxx で閉じる必要があるが、`onBeforeConnect` の
 * 契約（Response を返して拒否）ではその表現ができない。
 *
 * Playwright 側でも固定できない: `waitForResponse` は WebSocket のハンドシェイクを
 * 拾わないので、403 の観測自体ができなかった。
 */
