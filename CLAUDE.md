# 開発ルール

## 前提が曖昧なら実装前に聞く

指示に複数の読み方があり、**どちらを選ぶかで作るものが変わる**なら、
手を動かす前に確認する。勝手に解釈して進めない。

- 判断が要る例: 認可の範囲、既存 API の互換性を壊すか、新しい依存を足すか、
  永続化の場所（D1 か DO の SQLite か R2 か）
- 聞かなくていい例: 命名、ファイルの置き場所、テストの粒度。
  この文書と既存コードに答えがあるものは自分で決める

依存しない部分は先に片付けてから、質問を1回にまとめる。

## 失敗はルールにする

**エージェントが同じミスを2回したら、それはルールが足りていない。**
気づいた時点でこの文書に追記する。グローバルメモリではなくここに書く
（リポジトリと一緒にバージョン管理され、レビューできる）。

- 書く場所は**該当する節の中**。「なぜそうなるか」まで書く。
  例: 「port は必ず手書きする」も「`index.ts` が grep から漏れる」も、
  実際に踏んだ失敗から生えている
- 該当節が無ければ最下部の「失敗ログ」に足す。溜まって傾向が見えたら節に昇格させる
- 直った規約・消えたファイルを指すルールは消す。嘘のルールは無いより悪い

## ツールチェーンは mise が固定する

node / pnpm / `@antfu/ni` のバージョンは `mise.toml` で固定してある
（`packageManager` フィールドとも一致させてある）。

**グローバルの `pnpm` を直接叩かない。** シェルに mise の shim が通っていない環境
（Claude Code の Bash など）では `which pnpm` がグローバル版を指すことがあり、
別バージョンで `pnpm install` すると **`pnpm-lock.yaml` が数百行単位で書き換わる**。

```bash
mise x -- pnpm install   # shim が無い環境ではこちら
mise x -- pnpm <script>
```

`nr` / `na` / `nci` は mise 管理下の `@antfu/ni` なので、shim が通っていれば
そのまま使ってよい。迷ったら `pnpm --version` が `mise.toml` の値と一致するか確認する。

## コード変更後の検証

コードを変更したら、以下を実行してエラーがないことを確認する:

- `nr lint` (turbo 経由で全パッケージの oxlint)
- `nr format:check` (oxfmt でフォーマット差分の検出。**`package.json` も対象**)
- `nr typecheck` (turbo 経由で全パッケージの tsc --noEmit)
- `nr test` (turbo 経由で各パッケージの vitest)
- `nr knip` (未使用ファイル / 未使用依存。CI で落ちるのは error レベルのみ)

**「完了」= 上の4つが通り、変更が動くことを実際に確認した状態。**
テストを書かずに「動くはず」と報告しない。落ちたテストは報告に含める。

### E2E で通しを確認する

**認証・スレッド・添付・チャットのどれかを触ったら `nr test:e2e` を実行する。**
単体テストは port のスタブ越しなので、D1 のマイグレーション漏れ・R2 の署名・
WebSocket の `onBeforeConnect`・Vite の proxy といった**結線の失敗を検出できない**。

- `e2e/` は Playwright。`playwright.config.ts` の `webServer` が web のビルド →
  D1 の作り直し → `wrangler dev` まで自分でやるので、事前にサーバーを上げなくていい
- LLM は `E2E_FAKE_LLM:1` でダミーモデル（`infrastructure/ai/fake-model.ts`）に差し替わる。
  実物の Workers AI はストリームが切れてテストが不安定になるので使わない
- UI を変えたときは通ったことで満足しない。**長い日本語のスレッド名や大きい添付など
  現実的なデータを入れて、はみ出し・重なり・見切れをスクリーンショットで見る**

サーバーの起動手順（web ビルド → D1 の作り直し → `wrangler dev` → ダミー LLM）は
`e2e/scripts/serve.sh` が持つ。**Playwright も Maestro もこれを呼ぶ。**
手順を書き足すときはここだけを直す（2 箇所に書くと片方だけ直して黙って乖離する）。

### モバイルの E2E は Maestro（ローカル専用）

`nr test:e2e:mobile`。**CI には入れていない**（macOS runner と 20 分級のネイティブ
ビルドが毎 PR に乗るため）。CI 側は `nr build` の `expo export` が Metro /
NativeWind の結線だけを見ている。

- flow は `apps/mobile/.maestro/`。要素は `testID` で指す（文言を変えても壊れない）
- **添付のアップロードだけは Maestro から API を直接叩いている。** iOS の
  ドキュメントピッカーはアプリと別プロセスで、Maestro から確実に触れないため。
  裏返すと **RN の `fetch` から R2 へ PUT する経路には自動テストが無い**ので、
  添付まわりを触ったらシミュレータで実際に選んでアップロードすること

## 開発サーバー

- `nr dev` で全アプリを同時起動
- Claude Code から実行する場合は `na exec turbo run dev --ui=stream` を使う
- チャットの動作確認には `wrangler dev`（:8787）と `vite`（:5173）の両方が要る。
  ブラウザは :5173 を見る（Vite の proxy が `/api` と `/agents` を :8787 に流す）

## モノレポ構成

- `apps/server` - Hono + Agents SDK + Drizzle (Cloudflare Workers)
- `apps/web` - Vite + React + TanStack Router (SPA)
- `apps/mobile` - Expo（expo-router + NativeWind）。**iOS のみ保証**、Android は best-effort
- `packages/schema` - zod スキーマ・共有型
- `packages/api-client` - Hono RPC クライアントのファクトリ
- `packages/app-api` - web / mobile が共有する API 呼び出し（素の async 関数 + queryKey）
- `packages/design-tokens` - web / mobile が共有する CSS のトークン（生の値のみ）

## ファイル命名規則

- kebab-case を使用する (例: `my-component.tsx`, `use-auth.ts`)
- PascalCase は使わない

## API アーキテクチャ（Ports & Adapters + DDD 戦術パターン）

依存は**常に内向き**。外側は内側を知ってよいが、内側は外側を一切知らない。

```
domain/          エンティティ・値オブジェクト・port（境界の契約）
  shared/id.ts     ThreadId / AttachmentId / UserId（値オブジェクト）
  thread.ts        Thread（集約ルート）+ Title
  attachment.ts    Attachment（集約ルート）+ FileSize / ContentType
  ports/           driven port（repository / storage / conversation-store）
application/     ユースケース。port だけを知る
infrastructure/  d1/ r2/ auth/ ai/ agents/ — port を実装する adapter
presentation/    http/（Hono ルート）と agent/（WebSocket）
composition-root.ts  合成ルート。adapter を結線するのはここだけ（Hono に依存しない）
```

> 用語について: `port` / `adapter` は Hexagonal（Ports & Adapters, Cockburn）、
> リング構成と `domain` / `application` の呼び分けは Onion / Clean 由来。
> **厳密には出自が違うが、この組み合わせが実務で最も一般的**で、
> Robert C. Martin 自身も Hexagonal / Onion / Clean を同じ族として扱っている。
> 分類の正しさより、`ports/` と書けば「外側が挿さる境界」だと一目で伝わることを取る。

守るべきルール:

- `domain/` から外側のパッケージを import しない。`@repo/schema` も**使わない**
  （あれは HTTP のワイヤ形式であってドメインの語彙ではない）。zod だけ例外
- `application/` は `infrastructure/` / `presentation/` を参照しない
- **`drizzle(env.DB)` / `env.BUCKET` / `env.ChatAgent` を触ってよいのは
  `composition-root.ts` と `infrastructure/` だけ。** ルートやツールから直接触らない
- ドメイン ↔ ワイヤの変換は `presentation/http/dto.ts` に閉じる。
  `storageKey` のような保存先の内部事情はクライアントに出さない
- DI は関数引数で行う（tsyringe 等の DI コンテナは使わない）
- 複数エンティティにまたがるロジックが出てきたら `domain/services/` を足す。
  今は無いので作っていない

### composition-root.ts は Hono の作法ではない

**Hono 自身は DI コンテナも合成ルートも規定していない。** 公式が言うのは
「パス定義の直後にハンドラを書く」「リクエスト内の共有は `c.set()` / `c.var`」まで。
`composition-root.ts` は Ports & Adapters 側の要請で、Hono の外の話。
**DI コンテナではない**（レジストリもトークン解決もライフサイクル設定も無い Pure DI）。
ファイル名を `container.ts` にすると tsyringe 等と混同されるので使わない。

**Hono には依存させない。** `presentation/agent/chat-agent.ts` は Hono を通らない
（WebSocket）が同じ合成ルートを使う。結線をミドルウェアの中に書くと、
エージェント側に別の配線が要る。

**ただし Hono 側への配り方は Hono の作法に乗せる。** 各ハンドラで
`createServices(c.env)` を呼ばない。`injectServices` ミドルウェアが 1 回だけ
組み立てて `c.var.services` に載せる。

```ts
// presentation/http/routes/*.ts
.use("*", injectServices, requireAuth)
.get("/", async (c) => c.json(await c.var.services.threadService.list(c.get("userId"))))
```

### 集約の切り方

**Thread と Attachment は別々の集約ルート**で、`Attachment.threadId` という
**ID 参照**だけで繋がっている。オブジェクトグラフには入れない。

- **FK があることは集約境界の理由にならない。** 判定基準は「複数メンバーに
  またがって 1 トランザクションで守るべき不変条件があるか」だけ
- 現時点でそれは無い（添付数上限も合計サイズ上限も無い）。
  「ファイルは所有者のスレッドに属する」は**認可**であって不変条件ではない
- Attachment は `GET/PUT /api/files/:id` で単体アドレスされる経路があるので、
  Thread に束ねると 1 ファイル読むのに全添付をロードすることになる
- **束ねるべき合図**: 「1 スレッド合計 N MB まで」「添付は N 件まで」のような、
  兄弟全体を見ないと判定できないルールが入ったとき。そのとき Thread がルートになる

### 認可は delivery 境界の仕事

集約でも Application Service でもなく、HTTP は `requireAuth`、WebSocket は
`onBeforeConnect` が行う。ただし **Application Service の全メソッドは `ownerId` を
取ること。** 所有者を取らないメソッドを 1 つでも残すと「呼び出し元を信じる」
抜け道になり、新しい経路が増えたときに黙って認可が消える。

エージェントはインスタンス名（= threadId）しか持たないので、
`threadService.ownerOf()` で所有者を復元してから Application Service を呼ぶ。

### port は必ず手書きする

**`export type XRepository = ReturnType<typeof createXRepository>` と書かない。**
実装から推論すると依存が内側 → インフラの向きになり、次の 2 つが起きる:

1. 実装の都合が外へ漏れる（Drizzle の `.get()` は該当なしで `undefined` を返す）
2. テストのスタブが実装の型に合わせられず `as unknown as` キャストになり、
   **型検査が無効化される**。signature を変えてもテストは通ってしまう

`domain/ports/` に手で型を書き、`createD1XRepository(db): XRepository` と
戻り値型を明示して実装側が満たしに行く。`undefined` は実装内で `?? null` に正規化する。

### ID は zod の `.brand()` を使う

`as ThreadId` のような手書きキャストは嘘をつけるが、`threadIdSchema.parse(x)` は
つけない。zod をコアで使うのは**ライブラリの再利用**であって `@repo/schema`
（ワイヤ契約）への依存ではない。

- **検査する場所**: HTTP 入力（`zValidator` に branded スキーマをそのまま渡すと
  検証と brand 付けが同時に済み、形式違反が 500 ではなく 400 になる）と
  エンティティ生成時
- **検査しない場所**: DB の行 → ドメイン。書き込み時にファクトリを通っているので
  冗長で、将来ルールを厳しくしたとき既存行が読めなくなる罠を避ける（キャストにする）
- 取り違え防止が効いていることは `// @ts-expect-error` のテストで固定してある

新しい依存を足すときの順序: **domain/ports に port を書く → infrastructure で adapter を実装
→ application で使う → composition-root.ts で結線**。

### 依存の向きの検査

CI には入れていないので、迷ったら grep で確認する。

```bash
cd apps/server/src
grep -rE 'from "(drizzle-orm|hono|better-auth|@repo/schema)' domain/   # 何も出ないこと（zod は可）
grep -rn 'infrastructure/\|presentation/' application/                 # 何も出ないこと
# 合成ルート以外の配線を探す。**presentation/ だけを見ると index.ts が漏れる**
# （src 直下にあるので -r の対象外になり、実際にここをすり抜けた前例がある）
grep -rn 'env\.BUCKET\|drizzle(' presentation/ index.ts                # 何も出ないこと
```

## チャットとエージェント

- 会話履歴は `ChatAgent`（Durable Object）内蔵の SQLite が持つ。**D1 にメッセージ
  テーブルを作らない**
- Agent インスタンス名 = `threadId`（agent-per-thread）。スレッドごとに DO が分かれる
- LLM 呼び出しは AI SDK（`streamText`）、実行基盤・永続化・WebSocket は Agents SDK。
  この役割分担を混ぜない
- モデル選択は `apps/server/src/infrastructure/ai/model.ts` に集約する。プロバイダーを増やすときも
  ここだけを触る
- **Workers AI のモデルを変えるときはツール呼び出しが効くか必ず確認する。**
  function calling 非対応のモデルは JSON を本文にそのまま吐き、ツールが実行されない

## 認証（Better Auth）

- セッションの解決は `apps/server/src/presentation/http/middleware/auth.ts` の `requireAuth` だけが行う。
  他のレイヤーは `c.get("userId")` しか見ない
- `/agents/*` の WebSocket も `apps/server/src/index.ts` の `onBeforeConnect` で
  スレッド所有者かを検証している。**ここを外すと URL を知る誰でも他人の会話に入れる**
- 認証テーブル（`user` / `session` / `account` / `verification`）は
  `apps/server/src/infrastructure/d1/auth-schema.ts`。Better Auth の既定名に合わせてあるので
  リネームしない

## モバイル（Expo）

ネイティブ側の認証は `apps/mobile/README.md` に、WebSocket に cookie を載せる判断は
`docs/adr/0001-native-websocket-auth.md` にある。ここには**実際に踏んだ落とし穴**だけを置く。

- **`className` が効くのは `react-native` のコンポーネントだけ。** NativeWind の
  `globalClassNamePolyfill` は `react-native` の**解決を差し替える**仕組みなので、
  サードパーティ（`react-native-safe-area-context` など）には効かない。しかも
  エラーにならず**黙って無視される**ので、`flex-1` が付かず高さ 0 の空白画面になり、
  原因が分からなくなる。`src/components/safe-area-view.tsx` のように
  `useCssElement` で包む
- **Hermes には `crypto` も `MessageEvent` も無い。** 前者は AI SDK / Agents SDK が
  `crypto.randomUUID()` を使うため、後者は partysocket が受信フレームを
  `new MessageEvent()` に包み直すため要る。`src/lib/polyfills.ts` を
  `_layout.tsx` の先頭で import する。**どちらも型検査は通る。** crypto は画面を
  開いた瞬間に落ち、MessageEvent は「WebSocket は 101 で繋がるのにメッセージが
  1 通も届かない」という分かりにくい形で出る
- **ネイティブモジュール（`expo-*` の多く）を足したら再ビルドが要る。**
  Metro のリロードでは入らず「Cannot find native module」で落ちる
- **SecureStore は iOS の Keychain なので `clearState` では消えない。**
  Maestro の flow は `clearKeychain` を先に置く（無いと 2 回目がサインイン済みで始まる）
- **サインイン成功後の遷移は宣言的に書く。** `router.replace("/")` を呼ぶと
  `useSession()` の更新より先に遷移してしまい、`(app)` のガードが「未認証」と
  判断して押し戻す。ガードと同じストアを見て `<Redirect>` を返す

### バージョンを `^` で入れてはいけないもの

- **`better-auth` / `@better-auth/expo` は `~`。** `^1.6.30` は 1.7.0 を掴み、
  1.7 は `account` テーブルに `issuer` 列を足すので、D1 のマイグレーション無しでは
  サインアップが 500 になる。上げるときはスキーマ変更とセットで行う
- **`lightningcss` は `pnpm-workspace.yaml` の `overrides` で 1.30.1 に固定。**
  react-native-css（NativeWind v5）が 1.32 / 1.33 で Tailwind v4 の出力を読み戻せず、
  Metro の bundling が「failed to deserialize ... Specifier」で落ちる

## テスト

- TDD（テスト駆動開発）で実装する
- テストを先に書き、実装はテストが通るように行う
- application のテストでは port のスタブを渡す。
  **`as unknown as` でキャストしない**（手書きなのでスタブはそのまま型検査される）
- `FileStorage` も port なので、R2 を触らずインメモリの adapter でテストできる

## パッケージ間の依存関係

- `@repo/schema` は全アプリから参照可能
- `@repo/api-client` は `AppType` を **`import type` でのみ** 参照する
  （サーバーコードをクライアントにバンドルしない）

## 推奨 Claude Code スキル

- agents-sdk - Cloudflare Agents SDK
- ai-sdk - AI SDK（streamText / tools）
- tanstack-router - ファイルベースルーティング
- tanstack-query - サーバー状態管理
- cloudflare / wrangler - Cloudflare プラットフォーム
- frontend-design - フロントエンド UI 作成

## 失敗ログ

「失敗はルールにする」の受け皿。該当する節が無い失敗をここに1行で足す。
同じ話が3つ溜まったら節に昇格させる。

- （まだ無し。多くは既に該当節の中に書かれている:
  「port は必ず手書きする」「依存の向きの検査」の `index.ts` の件、
  「Workers AI のモデルを変えるときはツール呼び出しが効くか必ず確認する」）
