import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// ファイル名が DB ID のハッシュなので探す（metadata.sqlite は miniflare の内部用）。
// studio 専用なので、無ければ空文字で通す（generate / migrate は url を見ない）。
const localD1Dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const localD1 = (() => {
  try {
    const file = readdirSync(localD1Dir).find(
      (f) => f.endsWith(".sqlite") && f !== "metadata.sqlite",
    );
    return file ? `file:${resolve(localD1Dir, file)}` : "";
  } catch {
    return "";
  }
})();

export default defineConfig({
  schema: "./src/infrastructure/d1/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: { url: localD1 },
});
