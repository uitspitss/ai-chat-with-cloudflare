# ネイティブの WebSocket 認証は WebSocket 実装の差し替えで行う

React Native では Better Auth のセッション cookie が WebSocket ハンドシェイクに載らない
（`partysocket` は `new WS(url, protocols)` としか呼ばず、ブラウザ API にヘッダを差す口が無い）。
`agents` はこの用途に `useAgent({ query, cacheTtl })` を用意しているが、それは
**セッショントークンを URL に載せる**ことを意味し、`observability` が有効な本 Worker では
数日有効な資格情報がリクエストログに残り続ける。代わりに `PartySocketOptions.WebSocket` へ
React Native 固有の第 3 引数（`{ headers }`）を使う実装を注入し、本物の `Cookie` ヘッダを送る。

## Considered Options

- **`query` にトークンを載せる**（`agents` の想定経路）。URL にトークンが出るのを避けるには
  「WS 接続専用の短命チケット」という認可の概念をサーバーに 1 つ増やす必要があり、
  差し替えたい対象（クライアント側の 6 行）より大きい
- **サブプロトコル（`Sec-WebSocket-Protocol`）に載せる**。サーバーが 101 応答で同じ値を
  echo しないとクライアントが接続を破棄するが、Agents SDK の `routeAgentRequest` は
  `WebSocketPair` の accept を内部に隠しており `onBeforeConnect` からは触れない

## Consequences

- **サーバーの認可コードは変更なし。** `onBeforeConnect` / `requireAuth` は今までどおり
  `request.headers` からセッションを引く。web の e2e がネイティブの経路も同時に守る
- REST / `get-messages` / WebSocket の 3 経路すべてが「`Cookie` ヘッダを明示的に付ける」
  同じ仕組みになる
- **React Native 固有の拡張に依存する。** `WebSocket(url, protocols, { headers })` は
  Web 標準ではない（`react-native/Libraries/WebSocket/WebSocket.js`）
- **better-auth 1.7 で `authClient.getCookie()` が非同期になる。** WebSocket の
  コンストラクタは `await` できないため、cookie はモジュール変数にキャッシュしてある
