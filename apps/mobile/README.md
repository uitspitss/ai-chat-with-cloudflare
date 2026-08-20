# @repo/mobile

Expo（expo-router + NativeWind）。web と同じ機能一式（サインイン / スレッド /
チャット / 添付）が入っている。**保証対象は iOS のみ。** Android は動く見込みだが
確認していない。Expo web は対象外（`apps/web` がある）。

## 起動

```bash
mise install
ni                                       # リポジトリルートで
na --filter @repo/mobile run ios         # or android
```

サーバー（`wrangler dev`）が別途要る。`nr dev` で上げる。

`REACT_NATIVE_PACKAGER_HOSTNAME` を `localhost` に固定してある（上のスクリプト）。
**既定では開発機の LAN IP がアプリに焼かれるが、Metro は `::` にしか bind しないので
IPv4 のアドレスでは届かず、`The network connection was lost.` になる。**
実機で使うときだけ環境変数で上書きする。

## API のベース URL

Vite の proxy に相当する仕組みが Expo には無いので絶対 URL で叩く。
既定はシミュレータ / エミュレータ向けの値（`src/lib/env.ts`）。それ以外は
`EXPO_PUBLIC_API_URL` を明示する。

| 実行環境 | 値 |
|---|---|
| iOS シミュレータ | 既定のまま（`http://localhost:8787`） |
| Android Emulator | 既定のまま（`http://10.0.2.2:8787`） |
| 実機 | `EXPO_PUBLIC_API_URL=http://<開発機の LAN IP>:8787` を明示する |
| ステージング / 本番 | デプロイ先の `https://...` |

**開発機の LAN IP を既定にしてはいけない。** `wrangler dev` は `127.0.0.1` にしか
bind しないので、`Constants.expoConfig.hostUri` から組むとシミュレータから
一切繋がらない（実際にこれで白画面を踏んだ）。IP も繋ぎ直すたびに変わる。
実機から叩くときは `wrangler dev --ip 0.0.0.0` と、macOS のファイアウォールで
着信を許可することがセットで要る。

**そのオリジンはサーバーの `TRUSTED_ORIGINS` にも要る**
（dev は `apps/server/.dev.vars`、本番は `apps/server/wrangler.jsonc`）。

## 認証

Better Auth の Expo プラグイン。cookie は SecureStore（= iOS の Keychain）に入る。

**ネイティブの 4 経路すべてが `Cookie` ヘッダを明示的に付ける**という 1 つの仕組みに
揃えてある。サーバー側の認可コード（`onBeforeConnect` / `requireAuth`）は web と共通で、
モバイル用の分岐は無い。

| 経路 | どこで付けるか |
|---|---|
| REST | `src/lib/api.ts` の `cookieFetch` |
| `GET /agents/.../get-messages` | `useAgentChat` の `headers` |
| WebSocket | `src/lib/cookie-websocket.ts`（`useAgent` の `WebSocket` オプション） |
| 添付のダウンロード | `src/lib/api.ts` の `openAttachment`（`File.downloadFileAsync` の `headers`） |

WebSocket だけ実装ごと差し替えているのは、partysocket が `new WS(url, protocols)`
までしか呼ばずヘッダを差せないため。経緯は `docs/adr/0001-native-websocket-auth.md`。

**サーバー側にも `expo()` プラグインが要る**（`apps/server` の `createAuth`）。
Better Auth の origin 検査は `Origin` ヘッダを見るが RN の fetch はそれを送らず、
Expo クライアントが送るのは `expo-origin`。写す役がいないと `TRUSTED_ORIGINS` の
`aichat://` は照合されない。表に出るのはサインアウトだけなので気づきにくい
（詳細はリポジトリ直下の CLAUDE.md）。

cookie は `src/lib/auth.ts` のモジュール変数に写してある（WebSocket の
コンストラクタが `await` できないため）。サインイン / サインアウト /
フォアグラウンド復帰で更新する。

## スタイリング

NativeWind v5 preview + Tailwind v4。色や角丸の生の値は `@repo/design-tokens` を
`src/global.css` から `@import` して web と共有している（ダークは
`prefers-color-scheme`）。

**`className` が効くのは `react-native` のコンポーネントだけ。** NativeWind の
`globalClassNamePolyfill` は `react-native` の解決を差し替える仕組みなので、
サードパーティ（`react-native-safe-area-context` など）には効かず、
className を渡しても**黙って無視される**。`src/components/safe-area-view.tsx` の
ように `useCssElement` で包む。

## E2E（Maestro / ローカル専用）

```bash
nr test:e2e:mobile
```

サーバー起動 → ネイティブビルド → シミュレータへ導入 → `.maestro/` の flow を実行、
までスクリプトがやる（`scripts/e2e.sh`）。CI には入れていない（macOS runner と
20 分級のビルドが毎 PR に乗るため）。CI 側は `nr build` の `expo export` が
Metro / NativeWind の結線だけを見ている。

**添付のアップロードだけは Maestro から API を直接叩いている**（iOS の
ドキュメントピッカーはアプリと別プロセスで確実に触れないため）。裏返すと
RN の `fetch` から R2 へ PUT する経路には自動テストが無いので、添付まわりを
触ったらシミュレータで実際に選んでアップロードすること。写真なら
`xcrun simctl addmedia booted <画像>` でライブラリに 1 枚入れておける。

## 添付の入力

「ファイルを添付」（`expo-document-picker`）と「写真を添付」（`expo-image-picker`）の 2 つ。
**Files アプリと写真ライブラリは別のピッカー**で、前者に写真は出てこない。

どちらも権限の要求はしていない。iOS は PHPicker、Android は Photo Picker が使われ、
「選んだ 1 枚だけ」がアプリに渡る仕組みなのでライブラリ全体の許可が要らない
（`app.json` の `photosPermission` は Info.plist に載る説明文で、審査で読まれる）。

**サイズはピッカーの申告ではなく `expo-file-system` の `File.size` から取る。**
宣言したサイズと実体のバイト数が食い違うとサーバーが 413 で弾く。

## 添付を開く

タップ 1 回でアプリ内に全画面表示する（`src/components/attachment-preview.tsx`）。
WKWebView は画像も PDF もテキストもそのまま描画するので、**web のタブと同じものが出る**。
保存や他アプリへ送るのはヘッダの「共有」（`expo-sharing`）。

**URL をそのままビューアに渡してはいけない。** `/api/files/:id/content` は認証必須で、
SFSafariViewController も WKWebView も SecureStore の cookie を共有しないため 401 になる。
`downloadAttachment`（`src/lib/api.ts`）が `Cookie` 付きでキャッシュへ落とし、
WebView にはその `file://` を渡す。

- **`originWhitelist` に `file://*` を渡す。** 既定は `http(s)` だけで、外れた URL は
  ロードされず `Linking.openURL()` に回される。file:// は誰も開かないので
  **エラーも警告も出ずに白い画面のまま**になる（実際に踏んだ）
- **リモート URL を WebView に直接読ませない。** 401 が真っ白な画面にしかならず
  原因が追えない。落としてからにすれば `downloadFileAsync` が投げてくれる
- **「WebView が載った」を成功と見なさない。** 白い画面でも載ってはいる。
  `onLoad` が来るまでスピナーを退けない形にして、Maestro もそれが消えることを見る
- **拡張子を落とさない。** WKWebView は MIME を拡張子から推測するので、
  剥がすとプレビューが空になる
- **`WebView` に `className` は効かない**（サードパーティなので NativeWind の
  差し替えが届かない）。`style={{ flex: 1 }}` で書く

アップロードと同じく**この経路にも自動テストが無い**。添付まわりを触ったら
シミュレータで画像と PDF を実際に開いて確認すること。

## 既知の制約

**本番の Worker は Cloudflare Access の後ろにある。** アプリ側に Access を通る手段が
無いので、`EXPO_PUBLIC_API_URL` を本番に向けるとサインインも WebSocket も
Access のログイン画面へ 302 される。今のところ動くのはローカル（`wrangler dev` /
`e2e/scripts/serve.sh`）に対してだけ。本番でも使うなら `/api/*` と `/agents/*` を
Access の Bypass にする必要がある（アプリ自身が Better Auth で認証しているので、
二重に掛ける必然性は薄い）。

## まだ入れていないもの

- Android の動作確認
- `eas.json` と EAS Build / EAS Workflows の設定
- ネイティブディレクトリはコミットしていない（CNG。`expo run:ios` が生成する）
