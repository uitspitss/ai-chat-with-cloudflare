import { Platform } from "react-native";

/**
 * Expo には Vite の proxy に相当する仕組みが無いので、API は絶対 URL で叩く。
 *
 * 既定はシミュレータ / エミュレータ向けの値。
 *
 * **開発機の LAN IP（`Constants.expoConfig.hostUri`）を既定にしてはいけない。**
 * `wrangler dev` は `127.0.0.1` にしか bind しないので、LAN IP を指すと
 * シミュレータから一切繋がらない（一度これで白画面を踏んでいる）。
 * 加えて開発機の IP は繋ぎ直すたびに変わる。
 *
 * 実機から開発機を叩くときは `EXPO_PUBLIC_API_URL` を明示する。そのときは
 * サーバー側も `wrangler dev --ip 0.0.0.0` にして、macOS のファイアウォールで
 * 着信を許可する必要がある。
 */
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:8787`;
