import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const WRANGLER_ORIGIN = "http://localhost:8787";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  // shadcn の CLI が生成するコードは "@/..." で import する
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": { target: WRANGLER_ORIGIN, changeOrigin: true },
      // Agents SDK のチャットは WebSocket なので ws: true が必須
      "/agents": { target: WRANGLER_ORIGIN, changeOrigin: true, ws: true },
    },
  },
});
