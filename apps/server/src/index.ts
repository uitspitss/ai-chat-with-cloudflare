import { routeAgentRequest } from "agents";
import { createServices } from "./composition-root";
import { ThreadId, UserId } from "./domain/shared/id";
import type { Bindings } from "./env";
import { createAuth } from "./infrastructure/auth/better-auth";
import { app } from "./presentation/http/app";

export { ChatAgent } from "./presentation/agent/chat-agent";
export type { AppType } from "./presentation/http/app";

/**
 * Agent インスタンス名 = threadId。URL からそれを取り出し、ログイン中の
 * ユーザーがそのスレッドの持ち主であることを確認する。
 * ここを外すと URL を知っている誰でも他人の会話に接続できる。
 */
async function isThreadOwner(request: Request, env: Bindings) {
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  if (!session) return false;

  // /agents/chat-agent/<threadId>[/...]
  const parsed = ThreadId.safeParse(new URL(request.url).pathname.split("/")[3]);
  if (!parsed.success) return false;

  // 合成ルート経由で引く。ここで D1 を直に組み立てると配線が 2 本になり、
  // ファクトリの signature が変わっても**この経路だけ黙って通る**。
  // 認可の経路が横断的な処理から外れるのが一番まずい。
  const ownerId = await createServices(env).threadService.ownerOf(parsed.data);
  return ownerId === UserId.parse(session.user.id);
}

const forbidden = () => new Response("Forbidden", { status: 403 });

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // チャットの WebSocket / HTTP は Agents SDK が捌く。それ以外を Hono へ。
    if (url.pathname.startsWith("/agents/")) {
      const res = await routeAgentRequest(request, env, {
        onBeforeConnect: async (req) => ((await isThreadOwner(req, env)) ? undefined : forbidden()),
        onBeforeRequest: async (req) => ((await isThreadOwner(req, env)) ? undefined : forbidden()),
      });
      return res ?? new Response("Agent not found", { status: 404 });
    }

    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Bindings>;
