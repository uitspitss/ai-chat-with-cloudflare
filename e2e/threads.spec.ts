import { expect, test } from "@playwright/test";

test("スレッドを作成すると一覧に並び、チャット画面へ遷移する", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("新しいスレッドのタイトル").fill("E2E スレッド");
  await page.getByRole("button", { name: "作成" }).click();

  // 作成後はそのスレッドのチャット画面へ飛ぶ
  await expect(page).toHaveURL(/\/threads\/[0-9a-f-]{36}$/);
  await expect(page.getByPlaceholder("メッセージを入力")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "E2E スレッド" })).toBeVisible();
});

test("スレッドを削除すると一覧から消える", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("新しいスレッドのタイトル").fill("消す予定");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/threads\//);

  await page.goto("/");
  const row = page.getByRole("listitem").filter({ hasText: "消す予定" });
  await row.getByRole("button", { name: "削除" }).click();

  await expect(page.getByRole("link", { name: "消す予定" })).toHaveCount(0);
});

test("未ログインならサインイン画面へ飛ばされる", async ({ browser }) => {
  // storageState を空にして「ログインしていないブラウザ」を作る
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/);
  await context.close();
});
