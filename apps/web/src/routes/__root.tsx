import type { QueryClient } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth";

function Header() {
  const { data: session, isPending } = useSession();

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <Link to="/" className="font-semibold">
        AI Chat
      </Link>
      {!isPending && session && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut().then(() => window.location.assign("/sign-in"))}
          >
            <LogOutIcon data-icon="inline-start" />
            サインアウト
          </Button>
        </div>
      )}
    </header>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <Header />
      <Outlet />
    </div>
  ),
});
