"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";

export function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted-foreground">...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <NotificationCenter />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {session.user.email}
        </span>
        <Link href="/settings">
          <Button variant="ghost" size="sm" title="Settings">
            <Settings className="size-4" />
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
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
