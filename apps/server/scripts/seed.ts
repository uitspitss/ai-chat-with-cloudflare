/**
 * 開発用シード。`wrangler dev` を起動した状態で実行する。
 *
 *   nr dev            # 別ターミナルで
 *   nr db:seed
 *
 * D1 に直接 INSERT せず実際の API を叩くのは、Better Auth のパスワード
 * ハッシュ・セッション発行をアプリと同じ経路で通すため。
 */

const BASE_URL = process.env.SEED_BASE_URL ?? "http://localhost:8787";
const EMAIL = process.env.SEED_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "demo-password-1234";
const NAME = process.env.SEED_NAME ?? "Demo User";

const SAMPLE_FILE = {
  name: "release-notes.md",
  contentType: "text/markdown",
  body: `# リリースノート v1.2.0

- チャットのストリーミング応答を高速化
- ファイル添付を最大 25MB まで許可
- スレッド削除時に添付も同時に削除するよう修正

## 既知の問題
- Safari でスクロール位置が復元されない
`,
};

/** Set-Cookie を集めて以降のリクエストに載せる（ブラウザ相当の最小実装）。 */
let cookie = "";

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      // Better Auth は Origin 無しのリクエストを MISSING_OR_NULL_ORIGIN で弾く。
      // ここは TRUSTED_ORIGINS に含まれている必要がある。
      origin: BASE_URL,
      ...init.headers,
    },
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  return res;
}

async function jsonOrThrow(res: Response, what: string) {
  if (!res.ok) {
    throw new Error(`${what} に失敗 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function signIn() {
  const signUp = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
  });

  if (signUp.ok) {
    console.log(`✓ ユーザー作成: ${EMAIL}`);
    return;
  }

  // 2 回目以降のシードでは既に存在するのでサインインに切り替える
  const signIn = await api("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  await jsonOrThrow(signIn, "サインイン");
  console.log(`✓ 既存ユーザーでサインイン: ${EMAIL}`);
}

async function createThread(title: string): Promise<{ id: string }> {
  const res = await api("/api/threads", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  const thread = (await jsonOrThrow(res, `スレッド作成 "${title}"`)) as {
    id: string;
  };
  console.log(`✓ スレッド作成: ${title} (${thread.id})`);
  return thread;
}

async function attachSampleFile(threadId: string) {
  const size = new TextEncoder().encode(SAMPLE_FILE.body).byteLength;

  const urlRes = await api("/api/files/upload-url", {
    method: "POST",
    body: JSON.stringify({
      threadId,
      name: SAMPLE_FILE.name,
      size,
      contentType: SAMPLE_FILE.contentType,
    }),
  });
  const { uploadUrl } = (await jsonOrThrow(urlRes, "アップロード URL 発行")) as {
    uploadUrl: string;
  };

  const putRes = await api(uploadUrl, {
    method: "PUT",
    body: SAMPLE_FILE.body,
    headers: { "content-type": SAMPLE_FILE.contentType },
  });
  await jsonOrThrow(putRes, "ファイル本体のアップロード");
  console.log(`✓ ファイル添付: ${SAMPLE_FILE.name}`);
}

async function main() {
  console.log(`シード先: ${BASE_URL}`);
  await signIn();

  const thread = await createThread("リリースノートについて質問する");
  await attachSampleFile(thread.id);
  await createThread("雑談");

  console.log(`\n完了。${EMAIL} / ${PASSWORD} でログインできる。`);
}

main().catch((error) => {
  console.error(`\nシードに失敗した: ${error.message}`);
  console.error("wrangler dev が起動しているか、マイグレーション済みか確認する。");
  process.exit(1);
});
