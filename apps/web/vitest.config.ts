import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = import.meta.dirname;

/**
 * テストの入口が 2 つある。**どちらを壊しても「0 件で緑」になる。**
 *
 * - unit  : `include` の glob（src/**\/*.test.tsx）
 * - story : `.storybook/main.ts` の `stories` glob
 *
 * 件数を控えておくこと。増減させていないのに減っていたら glob が壊れている。
 */
export default defineConfig({
  // vitest.config.ts は vite.config.ts の resolve.alias を継承しないので同じものを書く
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["vitest.setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
