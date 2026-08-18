import { redirect } from "@tanstack/react-router";
import { authClient } from "./auth";

/** ルートの beforeLoad から呼ぶ。未ログインなら /sign-in へ飛ばす。 */
export async function requireSession() {
  const { data } = await authClient.getSession();
  if (!data) throw redirect({ to: "/sign-in" });
  return data;
}
