// スレッドに添付ファイルを 1 件登録する。attachment.yaml から runScript で呼ぶ。
//
// **アップロード自体はここ（API 直叩き）で行う。** iOS のドキュメントピッカーは
// アプリとは別プロセスで描画され、Maestro から確実に触れる保証が無いため。
// アプリ側で確かめるのは「添付一覧に出る」「LLM がその中身を読める」の 2 点。
//
// この方針の代償: **RN の fetch から R2 へ PUT する経路には自動テストが無い。**
// そこはシミュレータでの手動確認が担当する。

const BASE = MAESTRO_API_URL;
const jsonHeaders = { origin: BASE, "content-type": "application/json" };

function post(path, body, cookie) {
  return http.post(BASE + path, {
    headers: cookie ? Object.assign({}, jsonHeaders, { cookie }) : jsonHeaders,
    body: JSON.stringify(body),
  });
}

// UI と同じユーザーで入る。既に登録済みなら sign-in に落とす（chat.yaml が先に作る）
const credentials = { email: MAESTRO_EMAIL, password: MAESTRO_PASSWORD };
let auth = post("/api/auth/sign-up/email", Object.assign({ name: "Maestro User" }, credentials));
if (!auth.ok) auth = post("/api/auth/sign-in/email", credentials);
if (!auth.ok) throw new Error("認証に失敗した: " + auth.status + " " + auth.body);

const setCookie = auth.headers["set-cookie"] || auth.headers["Set-Cookie"];
const cookie = String(setCookie).split(";")[0];

const thread = JSON.parse(post("/api/threads", { title: "添付のテスト" }, cookie).body);

const content = "## 既知の問題\n- Safari でスクロール位置が復元されない\n";

// **文字数ではなくバイト数を宣言する。** 日本語が入ると UTF-8 で 3 倍になり、
// サーバーが content-length と食い違いを見て 413 で弾く（サイズ検査は正しい）。
// GraalJS には TextEncoder が無いのでこの書き方にしてある。
const byteLength = unescape(encodeURIComponent(content)).length;
const issued = JSON.parse(
  post(
    "/api/files/upload-url",
    {
      threadId: thread.id,
      name: "release-notes.md",
      size: byteLength,
      contentType: "text/markdown",
    },
    cookie,
  ).body,
);

const uploaded = http.request(BASE + issued.uploadUrl, {
  method: "PUT",
  headers: { cookie: cookie, "content-type": "text/markdown" },
  body: content,
});
if (!uploaded.ok) throw new Error("アップロードに失敗した: " + uploaded.status);

output.threadId = thread.id;
