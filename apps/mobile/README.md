# @repo/mobile

Expo（expo-router）の雛形。**画面の実装はまだ入っていない**（フェーズ2）。
`create-expo-app` のデフォルトテンプレートに、モノレポ対応と API クライアントの
配線だけを足した状態。

## 起動

```bash
mise install
ni                                  # リポジトリルートで
na --filter @repo/mobile run ios    # or android / web
```

## REST 接続（`packages/api-client`）

`src/lib/api.ts` が `createApiClient` を呼ぶだけの薄い層になっている。

```ts
import { api } from "@/lib/api";

const res = await api.api.threads.$get();
const threads = await res.json();
```

**API が返す `uploadUrl` / `downloadUrl` は相対パス。** ブラウザと違って RN の
`fetch` は解決してくれないので、`resolveApiUrl` を通してから使う。

```ts
import { resolveApiUrl } from "@repo/api-client";
import { API_BASE_URL, api } from "@/lib/api";

const { uploadUrl } = await (await api.api.files["upload-url"].$post({ json })).json();
await fetch(resolveApiUrl(API_BASE_URL, uploadUrl), { method: "PUT", body });
```

サーバーが絶対 URL を返さないのは、dev で Vite がプロキシしている都合上
サーバー側が「ブラウザから見えているオリジン」を知れないため。

**Web との違いは「絶対 URL が必要」な点。** Vite の proxy に相当する仕組みが Expo には
ないので、`EXPO_PUBLIC_API_URL` でベース URL を切り替える。

| 実行環境 | 値 |
|---|---|
| iOS シミュレータ | `http://localhost:8787` |
| Android Emulator | `http://10.0.2.2:8787` |
| 実機 | `http://<開発マシンの LAN IP>:8787` |
| ステージング / 本番 | デプロイ先の `https://...` |

`.env.local` / `.env.production` などに書き分ける。

### 認証（Better Auth）

セッションは cookie で運ぶ。`createApiClient` は `credentials: "include"` を付けて
いるが、**React Native の `fetch` は cookie jar を自動では持たない**。実装時は次の
どちらかが必要になる:

- `@react-native-cookies/cookies` を入れて cookie を永続化する
- Better Auth の Expo プラグイン（`better-auth/expo`）を使い、SecureStore に
  セッションを保存する ← 推奨

いずれの場合も、サーバー側の `TRUSTED_ORIGINS` にアプリのオリジンを追加すること。

## チャット接続

チャットは REST ではなく **Agents SDK の WebSocket** を使う（`useAgent` +
`useAgentChat`、インスタンス名 = `threadId`）。Web 側の
`apps/web/src/routes/threads.$threadId.tsx` が参照実装。

**ただし `agents/react` の React Native 上での動作は未検証。** 動かない場合は
`AgentClient`（vanilla、`agents` パッケージ）を RN 向けにラップする方針で進める。
`AgentClient` は標準の `WebSocket` の上に乗っているだけなので、RN の WebSocket
実装でそのまま動く見込みが高い。

## まだ入れていないもの

- 画面の実装（スレッド一覧 / チャット）
- NativeWind（スタイリング）
- `eas.json` と EAS Build / EAS Workflows の設定
- ネイティブビルド（`ios/` `android/` は生成していない。CNG のまま）
