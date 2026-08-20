# AI Chat

ユーザーが自分のスレッドの中で LLM と会話し、そのスレッドにファイルを添付して
内容について尋ねられるアプリケーション。

## Language

**Thread**:
ひとつの会話のまとまり。所有者とタイトルを持つ集約ルート。
_Avoid_: 会話, トーク, ルーム, チャットルーム, Conversation

**Attachment**:
Thread に添付されたファイル。Thread とは独立した集約ルートで、`threadId` による
ID 参照だけで Thread に繋がる。
_Avoid_: 添付ファイル以外の呼び方（ドキュメント, アセット, メディア）

**Message**:
Thread の中でユーザーまたはアシスタントが発した 1 発言。Thread の一部ではなく、
その Thread の ChatAgent が保持する。
_Avoid_: 発言, チャット, ログ

**ChatAgent**:
ひとつの Thread に 1 対 1 で対応し、その Thread の Message 全体を保持する実行単位。
インスタンス名は Thread の ID と等しい。
_Avoid_: セッション, ボット, ワーカー

**履歴消去**:
ある Thread の Message をすべて捨てる操作。Thread 自体は残る。
**スレッド削除**（Thread ごと消え、Attachment も Message も失われる）とは別の操作。
_Avoid_: クリア, リセット（どちらを指すか判別できない）

**Session**:
サインイン済みのユーザーを識別する資格情報。Thread の所有者判定はこれを通してのみ行う。
_Avoid_: ログイン, 認証情報, トークン

**User**:
アカウントを持つ人。Thread と Attachment の所有者。
_Avoid_: アカウント, メンバー, 顧客
