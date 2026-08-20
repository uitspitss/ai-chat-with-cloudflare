import { currentCookie } from "./auth";

/**
 * React Native の WebSocket は第 3 引数で任意ヘッダを受ける
 * （`react-native/Libraries/WebSocket/WebSocket.js` の constructor → `NativeWebSocketModule.connect`）。
 *
 * **Web 標準ではないので、どの型定義にもこの引数は無い**（DOM も Workers も 2 引数）。
 * 型を自分で書くしかないが、実体は RN のグローバルそのものなのでキャストで足りる。
 */
type NativeWebSocketConstructor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> },
) => WebSocket;

const NativeWebSocket = WebSocket as unknown as NativeWebSocketConstructor;

/**
 * `Cookie` ヘッダを送る WebSocket。`useAgent` の `WebSocket` オプションに渡す。
 *
 * partysocket は `new WS(url, protocols)` までしか呼ばない（`dist/ws.js` の `_connect`）。
 * ブラウザの WebSocket にヘッダを差す口が無いためだが、実装ごと差し替えれば
 * サーバーの `onBeforeConnect` は今までどおりヘッダからセッションを引ける。
 * **認可の経路が web と 1 本のまま**になる。判断の経緯は docs/adr/0001。
 *
 * cookie を `currentCookie()`（同期）から読むのは、コンストラクタが `await` できないため。
 */
export class CookieWebSocket extends NativeWebSocket {
  constructor(url: string, protocols?: string | string[]) {
    super(url, protocols, { headers: { Cookie: currentCookie() } });
  }
}
