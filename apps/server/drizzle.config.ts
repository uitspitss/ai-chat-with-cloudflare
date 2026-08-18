import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/d1/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
});
