#!/usr/bin/env sh
#
# モバイルの E2E（Maestro）。**ローカル専用で CI には入れていない。**
# macOS runner と 20 分級のネイティブビルドが毎 PR に乗るため。
# CI 側は `nr build` の `expo export` が Metro / NativeWind の結線だけを見ている。
#
# 前提: Xcode と iOS シミュレータ、Maestro（https://maestro.dev）。
#
#   sh apps/mobile/scripts/e2e.sh
#
# 保証しているのは iOS のみ（Android は best-effort）。
set -eu

PORT="${E2E_PORT:-8788}"
API_URL="http://localhost:${PORT}"
DEVICE="${E2E_IOS_DEVICE:-iPhone 17 Pro}"

cd "$(dirname "$0")/../../.."
ROOT="$PWD"

command -v maestro >/dev/null 2>&1 || {
  echo "maestro が見つからない。https://maestro.dev の手順で入れる" >&2
  exit 1
}

# Better Auth の署名鍵。serve.sh が起動する wrangler が読む
[ -f apps/server/.dev.vars ] || echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" > apps/server/.dev.vars

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "${METRO_PID:-}" ] && kill "$METRO_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Playwright と同じ起動スクリプトを使う。D1 の作り直しとダミー LLM もここが面倒を見る
echo "==> サーバーを起動する (${API_URL})"
E2E_PORT="$PORT" sh e2e/scripts/serve.sh > /tmp/mobile-e2e-server.log 2>&1 &
SERVER_PID=$!

i=0
until curl -sf "${API_URL}/api/auth/get-session" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 120 ] && { echo "サーバーが上がらない。/tmp/mobile-e2e-server.log を見る" >&2; exit 1; }
  sleep 1
done

# EXPO_PUBLIC_* はバンドル時に埋め込まれるので、Metro をこの環境で起動する必要がある。
# REACT_NATIVE_PACKAGER_HOSTNAME はアプリに焼かれる Metro の URL。既定では開発機の
# LAN IP が入るが、Metro は :: にしか bind しないので IPv4 では届かない。
# 初回はネイティブビルドが走るので数分かかる（2 回目以降は増分）。
echo "==> アプリをビルドしてシミュレータに入れる (${DEVICE})"
cd "$ROOT/apps/mobile"
EXPO_PUBLIC_API_URL="$API_URL" REACT_NATIVE_PACKAGER_HOSTNAME=localhost \
  pnpm exec expo run:ios --device "$DEVICE" > /tmp/mobile-e2e-metro.log 2>&1 &
METRO_PID=$!

i=0
until curl -sf "http://localhost:8081/status" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 900 ] && { echo "Metro が上がらない。/tmp/mobile-e2e-metro.log を見る" >&2; exit 1; }
  sleep 1
done

echo "==> Maestro"
cd "$ROOT/apps/mobile"
maestro test -e MAESTRO_API_URL="$API_URL" .maestro
