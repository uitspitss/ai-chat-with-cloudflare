import { createApiClient } from "@repo/api-client";

// Vite の proxy に相当する仕組みが Expo には無いので、ベース URL を環境変数で切り替える。
// 実機は LAN IP、Android Emulator は 10.0.2.2 を指定する。
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = createApiClient(API_BASE_URL);
