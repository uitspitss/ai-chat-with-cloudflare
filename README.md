# ai-chat-with-cloudflare

Cloudflare だけで組んだエージェンティックチャット。Workers / D1 / R2 / Durable Objects
の上に Cloudflare Agents SDK と AI SDK を載せ、Web（SPA）と将来の Expo アプリが
同じ型付き API クライアントを共有する。

- チャットは **Agents SDK の WebSocket**（`useAgentChat`）。SSE 経路は作らない
- REST は **Hono RPC**（`hc<AppType>`）。Web と Expo で同じクライアントを使う
- 会話履歴は **`ChatAgent`（Durable Object）内蔵の SQLite**。D1 にメッセージテーブルは無い
- ファイルは **R2**。Hono がアップロード用エンドポイントを発行する

## Getting Started

```bash
# ランタイムのインストール
mise install

# 依存関係のインストール
ni

# Better Auth の署名鍵をローカル用に用意する（.dev.vars は git 管理外）
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" > apps/server/.dev.vars

# ローカル D1 にマイグレーションを適用
na --filter @repo/server run db:migrate:local

# 開発サーバーの起動（wrangler :8787 + vite :5173）
nr dev

# 別ターミナルでシード（デモユーザー・スレッド・添付ファイル）
na --filter @repo/server run db:seed
```

ブラウザで <http://localhost:5173> を開き、`demo@example.com` /
`demo-password-1234` でサインインする。

**必ず :5173 を見ること。** Vite の proxy が `/api` と `/agents`（WebSocket 含む）を
:8787 の wrangler に流している。:8787 を直接開くと SPA が配信されない。

## Available Scripts

| コマンド | 説明 |
|---|---|
| `nr dev` | 全アプリの開発サーバーを起動（turbo） |
| `nr build` | 全パッケージをビルド |
| `nr lint` | 全パッケージの oxlint チェック |
| `nr typecheck` | 全パッケージの型チェック |
| `nr test` | 全パッケージのテスト実行 |
| `nr format` | oxfmt でフォーマット |
| `nr format:check` | oxfmt でフォーマット差分の検出のみ |
| `nr knip` | 未使用コード・依存関係の検出 |
| `na --filter @repo/server run db:generate` | マイグレーション生成 |
| `na --filter @repo/server run db:migrate:local` | ローカル D1 に適用 |
| `na --filter @repo/server run db:migrate:remote` | 本番 D1 に適用 |
| `na --filter @repo/server run db:seed` | 開発用シード（要 `wrangler dev`） |
| `na --filter @repo/server run db:studio` | Drizzle Studio |
| `na --filter @repo/web run dev` | Web のみ起動 |
| `na --filter @repo/mobile run ios` | iOS シミュレータ（雛形のみ） |

## Project Structure

```
├── apps/
│   ├── server/                  # Hono + Agents SDK + Drizzle (Cloudflare Workers)
│   │   ├── src/                 # オニオン。依存は常に内向き
│   │   │   ├── domain/          # ← 中心。何にも依存しない（zod のみ）
│   │   │   │   ├── shared/id.ts     # ThreadId / AttachmentId / UserId（VO）
│   │   │   │   ├── thread.ts        # Thread（集約ルート）+ Title
│   │   │   │   ├── attachment.ts    # Attachment（集約ルート）+ FileSize 等
│   │   │   │   └── ports/           # 手書きの port（repository / storage / 会話履歴）
│   │   │   ├── application/     # Application Services
│   │   │   │   ├── thread-service.ts
│   │   │   │   └── file-service.ts
│   │   │   ├── infrastructure/  # port を実装する adapter
│   │   │   │   ├── d1/              # schema / repository
│   │   │   │   ├── r2/              # FileStorage の実装
│   │   │   │   ├── auth/            # Better Auth
│   │   │   │   ├── agents/          # 会話履歴（Durable Object）の破棄
│   │   │   │   └── ai/              # Workers AI / Anthropic の切り替え
│   │   │   ├── presentation/    # delivery mechanism
│   │   │   │   ├── http/            # Hono ルート、dto、認証ミドルウェア
│   │   │   │   └── agent/           # AIChatAgent とツール定義
│   │   │   ├── composition-root.ts  # 合成ルート（結線はここだけ / DI コンテナではない）
│   │   │   └── index.ts             # Worker エントリ。/agents/* を routeAgentRequest へ
│   │   ├── scripts/seed.ts
│   │   ├── drizzle/migrations/
│   │   └── wrangler.jsonc
│   ├── web/                     # Vite + React + TanStack Router (SPA)
│   │   └── src/
│   │       ├── components/      # message-parts / thread-files
│   │       ├── lib/             # api（Hono RPC）/ auth（Better Auth）
│   │       └── routes/          # / , /sign-in , /threads/$threadId
│   └── mobile/                  # Expo（雛形のみ。README を参照）
├── packages/
│   ├── schema/                  # zod スキーマ・共有型
│   └── api-client/              # createApiClient(baseUrl, fetchImpl?)
├── turbo.json
├── pnpm-workspace.yaml
├── .oxlintrc.json / .oxfmtrc.json / lefthook.yml / knip.jsonc
└── .config/wt.toml
```

## LLM プロバイダー

既定は **Workers AI**（`@cf/zai-org/glm-4.7-flash`）。`wrangler dev` からローカルでも
呼べるので、API キー無しで動く。`ANTHROPIC_API_KEY` を設定すると Anthropic に切り替わる。

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> apps/server/.dev.vars
```

切り替えは `apps/server/src/infrastructure/ai/model.ts` の 1 ファイルに閉じている。

> **モデルを変えるときの注意**: function calling に対応していない Workers AI モデルは、
> ツール呼び出しを JSON テキストとして本文に吐いてしまい、ツールが実行されない
> （`@cf/meta/llama-3.3-70b-instruct-fp8-fast` で確認済み）。差し替えたら必ず
> ツールが実際に動くところまで確認すること。

## ファイルアップロードの流れ

1. `POST /api/files/upload-url` — メタデータを D1 に記録し、`uploadUrl` を返す
2. クライアントがその URL に `PUT` でファイル本体を送る
3. エージェントは `listThreadFiles` / `readThreadFile` ツールで R2 から読む

現状 2 は R2 binding 経由の Worker エンドポイント。R2 の S3 互換 API で本物の
presigned URL を発行する構成に差し替えても、**クライアント側の手順（返された URL に
PUT する）は変わらない**ようにしてある。

## デプロイ

wrangler はグローバルに入れず `apps/server` の devDependency で固定してある。
`na exec` 経由で呼び、**`apps/server` で実行する**（wrangler はカレントから
`wrangler.jsonc` を探すので、ルートから叩くと設定なしで動いてしまう）。

```bash
cd apps/server

# 1. D1 を作る
na exec wrangler d1 create ai-chat-with-cloudflare-db
# 出力された database_id を wrangler.jsonc の **既存の DB binding** に入れる。
# create は既存 binding を見ずに新しい binding を追記するので、生成された
# ai_chat_with_cloudflare_db は消すこと（残すと同じ D1 に binding が 2 つ張られ、
# 追記されたほうは migrations_dir を持たないためマイグレーションがずれる）

# 2. R2 バケットを作る（1 と同様、追記された binding は消す）
na exec wrangler r2 bucket create ai-chat-with-cloudflare-files

# 3. 本番の秘密鍵を登録
na exec wrangler secret put BETTER_AUTH_SECRET

# 4. 本番オリジンを wrangler.jsonc の vars に反映
#    BETTER_AUTH_URL / TRUSTED_ORIGINS を https://<本番ドメイン> に変える
#
#    **これをやると vars から localhost が消える。** dev の値は dev-secrets.enc に
#    入れてあり、`secrets:pull` が生成する .dev.vars が vars を上書きするので
#    ローカルは動き続ける。pull していない人は先に pull させること
#    （wrangler.jsonc だけ変えて配ると、全員のローカルのサインインが
#     INVALID_ORIGIN で 403 になる。CI は --var を渡すので緑のまま気づけない）

# 5. マイグレーション適用 -> ビルド -> デプロイ（ここからはリポジトリルートで）
cd ../..
na --filter @repo/server run db:migrate:remote
na exec turbo run build --filter=@repo/server
na --filter @repo/server run deploy
```

Web は Workers Static Assets として **server と同じ Worker** から配信される
（`apps/server/wrangler.jsonc` の `assets`）。`/api/*` と `/agents/*` だけ
`run_worker_first` で Worker を先に通し、それ以外は SPA へフォールバックする。

GitHub Actions からデプロイする場合は `CLOUDFLARE_API_TOKEN` と
`CLOUDFLARE_ACCOUNT_ID` を secrets に登録する（`.github/workflows/ci.yml` の
`deploy` ジョブ）。

**上の 1 と 4 を済ませるまで、CI は本番デプロイを拒否する。** `wrangler deploy` は
`wrangler.jsonc` の `vars` を本番へ**上書き**するため、dev 既定値のまま main に
merge すると本番の `BETTER_AUTH_URL` / `TRUSTED_ORIGINS` が localhost に戻り、
サインインが Origin 検証で 403 になる。`ci.yml` の `deploy` ジョブ先頭で
プレースホルダと localhost を検出して落としてある。

デプロイは `ci.yml` の 3 つ目のジョブとして同居させてある（`needs: [ci, e2e]`）。
**ワークフローを分けると checkout / `nci` / typecheck / lint / test が丸ごと
二重に走る**（turbo のリモートキャッシュが無いので本当に再計算になる）ため。

## 環境変数

| 変数 | 置き場所 | 用途 |
|---|---|---|
| `BETTER_AUTH_SECRET` | `.dev.vars` / `wrangler secret` | セッション署名鍵。**必須** |
| `BETTER_AUTH_URL` | `wrangler.jsonc` の `vars` | ブラウザから見えるオリジン |
| `TRUSTED_ORIGINS` | `wrangler.jsonc` の `vars` | カンマ区切り。CORS / Origin 検証 |
| `ANTHROPIC_API_KEY` | `.dev.vars` / `wrangler secret` | あれば Anthropic に切り替え |

本番は `wrangler secret put`、CI は GitHub Secrets（`CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID`）。**Cloudflare の認証情報はリポジトリに置かない。**

### チームで共有するローカル秘密（dotenvx）

`ANTHROPIC_API_KEY` のように**全員が同じ値を使う**ものは、暗号化した
`apps/server/dev-secrets.enc` をコミットして配る。復号キー `apps/server/.env.keys`
は gitignore 済みなので、1Password 等で別途共有する。

現在の中身:

| 変数 | 理由 |
|---|---|
| `BETTER_AUTH_SECRET` | セッション署名鍵 |
| `BETTER_AUTH_URL` | **dev 用の localhost 値。** `wrangler.jsonc` の `vars` は本番値になるので、これで上書きする |
| `TRUSTED_ORIGINS` | 同上。Vite（:5173）と wrangler（:8787）の両方を入れる |

```bash
# 受け取る側: dev-secrets.enc -> .dev.vars を生成する
na --filter @repo/server run secrets:pull

# 追加する側: dev-secrets.enc に平文で 1 行足してから
na --filter @repo/server run secrets:push   # 平文の行だけ暗号化される（既存は変わらない）
```

**`secrets:pull` は `.dev.vars` を上書きする。** 手元だけの値を持たせたい場合は
pull のあとに追記する（`nr dev` では自動実行しない）。

一時ファイルに書いてから `mv` しているのは、**復号に失敗したときに既存の
`.dev.vars` を壊さないため**。`> .dev.vars` と直接書くと、リダイレクトが
コマンド実行前に truncate するので、鍵を持っていない人が pull しただけで
手元の秘密が消える。

`.dev.vars` を直接暗号化しないのは、**wrangler が `.dev.vars` をファイルとして読み、
平文を期待する**から。暗号化すると `encrypted:...` という文字列がそのまま値として
注入され、エラーも出ずに壊れる。

## Tech Stack

| レイヤー | 採用 |
|---|---|
| インフラ | Cloudflare Workers / D1 / R2 / Durable Objects |
| エージェント基盤 | Cloudflare Agents SDK (`agents`, `@cloudflare/ai-chat`) |
| LLM 呼び出し | AI SDK (`ai`) + `workers-ai-provider` / `@ai-sdk/anthropic` |
| バックエンド | Hono + Drizzle ORM |
| 認証 | Better Auth (email + password) |
| フロントエンド | Vite + React + TanStack Router / Query + Tailwind CSS |
| モバイル | Expo + expo-router（雛形のみ） |
| モノレポ | pnpm workspaces + Turborepo |
| ツール | mise / oxlint / oxfmt / lefthook / knip / dotenvx / worktrunk |
