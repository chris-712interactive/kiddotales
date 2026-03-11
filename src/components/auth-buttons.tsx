"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Settings, LogOut } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";

export function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted-foreground">...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationCenter />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {session.user.email}
        </span>
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="size-9 sm:size-8" title="Settings" aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="size-9 justify-center px-2 sm:size-auto sm:px-3"
          onClick={() => signOut()}
          aria-label="Sign out"
        >
          <LogOut className="size-4 sm:hidden" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => signIn("google", { callbackUrl: "/create" })}>
      Sign in
    </Button>
  );
}
