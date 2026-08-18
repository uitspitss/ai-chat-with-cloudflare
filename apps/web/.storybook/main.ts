import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

/** monorepo / Yarn PnP でも addon の実体を解決できるようにする。 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

const config: StorybookConfig = {
  // components/ui は shadcn の生成物だが、**ストーリーの対象からは外さない**。
  // 見た目を確かめたい相手そのものなので、除外すると Storybook を入れた意味が減る。
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],

  addons: [
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],

  framework: getAbsolutePath("@storybook/react-vite"),

  viteFinal: (vite) => {
    // **vitest から走る storybook プロジェクトでは vite.config.ts が読まれない。**
    // Tailwind v4 はプラグインで CSS を生成するので、無いと @import "tailwindcss" が
    // 素通しになり「素の HTML だが表示はされる」状態になる。エラーは出ない。
    // storybook dev / build では vite.config.ts が読まれるため、二重登録を避ける。
    const plugins = (vite.plugins ??= []);
    const hasTailwind = plugins
      .flat(Number.POSITIVE_INFINITY)
      .some(
        (p) => p && typeof p === "object" && "name" in p && String(p.name).includes("tailwind"),
      );
    if (!hasTailwind) plugins.push(tailwindcss());

    // alias も同じ理由でここに明示する。無いと "@/lib/utils" が解決できず、
    // その失敗が optimizeDeps のエラーを巻き添えにして原因が二重に見える。
    vite.resolve ??= {};
    vite.resolve.alias = Array.isArray(vite.resolve.alias)
      ? [...vite.resolve.alias, { find: "@", replacement: srcDir }]
      : { ...vite.resolve.alias, "@": srcDir };
    return vite;
  },
};

export default config;
