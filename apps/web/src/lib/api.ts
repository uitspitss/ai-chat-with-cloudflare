import { createAppApi } from "@repo/app-api";

// dev は Vite の proxy、本番は同一 Worker から配信されるので相対 URL で足りる。
// 認証は cookie が自動で載るので fetch の差し替えは要らない（ネイティブ側だけが渡す）。
export const appApi = createAppApi({ baseUrl: "/" });
