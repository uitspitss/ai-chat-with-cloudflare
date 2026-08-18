import { createApiClient } from "@repo/api-client";

// dev は Vite の proxy、本番は同一 Worker から配信されるので相対 URL で足りる。
export const api = createApiClient("/");
