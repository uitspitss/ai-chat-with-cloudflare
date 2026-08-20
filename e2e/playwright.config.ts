import { defineConfig, devices } from "@playwright/test";

/**
 * E2E は「本番相当の 1 Worker」に対して回す。
 *
 * `vite preview` では駄目で、`wrangler dev` が要る。このアプリはチャットが
 * Durable Object、認可が D1、添付が R2 と **bindings 越しの経路そのもの**が
 * テスト対象だから。本番も同じ Worker が SPA を assets として配る構成なので、
 * これがそのまま本番相当になる。
 */

// 起動手順そのものは e2e/scripts/serve.sh が持つ（Maestro も同じものを呼ぶ）。
// ポートの既定値だけはここでも要る（Playwright が疎通を待つ URL に使う）。
const PORT = 8788;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  // Vitest（*.test.ts）と取り合わないよう E2E は *.spec.ts に統一する
  testMatch: /.*\.(spec|setup)\.ts/,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 同じ D1 を見るので並列にしない（件数を数えるテストが他の挿入で落ちる）
  workers: 1,

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: { baseURL: BASE_URL, trace: "on-first-retry" },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      // **testMatch を必ず絞る。** 省くと上位の testMatch を継承して
      // auth.setup.ts まで拾い、setup が 2 回走る（2 回目は「ユーザーが既に存在」で落ちる）
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: `E2E_PORT=${PORT} sh e2e/scripts/serve.sh`,
    cwd: "..",
    url: BASE_URL,
    // ローカルは既に上げてあるサーバーを使い回す。CI では必ず新しく起動する
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // 既定の "ignore" だとサーバー側の 500 が握り潰され、
    // 「要素が見つからない」としか出なくなる
    stdout: "pipe",
    stderr: "pipe",
  },
});
