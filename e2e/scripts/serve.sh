#!/usr/bin/env sh
#
# E2E 用のサーバーを「本番相当の 1 Worker」として上げる。
# **Playwright（webServer）と Maestro の両方がこれを呼ぶ。**
# 手順を 2 箇所に書くと、片方だけ直したときに黙って乖離する。
#
# 環境変数で上書きできるもの:
#   E2E_PORT       既定 8788。開発サーバー（8787 / 5173）とずらして開発用 DB を守る
#   E2E_STATE_DIR  既定 .wrangler/e2e-state。D1/R2/DO の状態の隔離先
#
# **ホストは localhost 固定。** `wrangler dev` に `--ip` を渡していないので 127.0.0.1 に
# しか bind せず、URL だけ LAN IP に差し替えても実機からは到達できない。実機で回すなら
# `--ip 0.0.0.0` の追加と BASE_URL / TRUSTED_ORIGINS の変更がセットで要る。
# シミュレータはホストとネットワークを共有するので localhost で足りる。
set -eu

PORT="${E2E_PORT:-8788}"
STATE_DIR="${E2E_STATE_DIR:-.wrangler/e2e-state}"
BASE_URL="http://localhost:${PORT}"

# リポジトリのルートで動く前提に揃える
cd "$(dirname "$0")/../.."

# web の dist が無いと wrangler が assets.directory を解決できずに落ちる
pnpm --filter @repo/web run build

# 毎回まっさらな D1 から始める。テストが自分でデータを作る前提にできる
rm -rf "apps/server/${STATE_DIR}"
pnpm --filter @repo/server exec wrangler d1 migrations apply DB --local --persist-to "${STATE_DIR}"

# **--local は必須。** Workers AI にはローカル実装が無いので、既定では wrangler が
# 起動時に AI binding のリモートプロキシを張りに行き、非対話環境では
# CLOUDFLARE_API_TOKEN が無いと起動そのものが失敗する（CI がここで落ちていた）。
# --local は全 binding をローカルに倒し、env.AI を "not supported" にする。
# E2E_FAKE_LLM=1 のとき env.AI は参照されないので、これで困らない。
#
# TRUSTED_ORIGINS に aichat:// を入れておく。ネイティブアプリは deep link scheme を
# Origin として送るので、入れないとサインインが CSRF として弾かれる。
exec pnpm --filter @repo/server exec wrangler dev \
  --local \
  --port "${PORT}" \
  --persist-to "${STATE_DIR}" \
  --var "BETTER_AUTH_URL:${BASE_URL}" \
  --var "TRUSTED_ORIGINS:${BASE_URL},aichat://" \
  --var "E2E_FAKE_LLM:1"
