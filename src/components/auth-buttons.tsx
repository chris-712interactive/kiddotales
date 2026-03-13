"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Bell, Settings, LogOut, BookMarked } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface AuthButtonsProps {
  variant?: "default" | "drawer";
  setOpen?: (open: boolean) => void;
}

export function AuthButtons({ variant = "default", setOpen }: AuthButtonsProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted-foreground">...</span>;
  }

  if (session?.user) {
    if (variant === "drawer") {
      return (
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="truncate text-sm text-muted-foreground">
              {session.user.email}
            </span>
          </div>
          <Link href="/notifications" className="block w-full" onClick={() => setOpen?.(false)}>
            <Button variant="ghost" className="w-full justify-start">
              <Bell className="mr-2 size-4" />
              Notifications
            </Button>
          </Link>
          <Link href="/settings/books" className="block w-full" onClick={() => setOpen?.(false)}>
            <Button variant="ghost" className="w-full justify-start">
              <BookMarked className="mr-2 size-4" />
              My books
            </Button>
          </Link>
          <Link href="/settings" className="block w-full" onClick={() => setOpen?.(false)}>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 size-4" />
              Settings
            </Button>
          </Link>
          <ThemeToggle variant="drawer" />
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => signOut()}
            aria-label="Sign out"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
      );
    }
  }

  return (
    <Button
      size={variant === "drawer" ? "default" : "sm"}
      className={variant === "drawer" ? "w-full justify-center" : undefined}
      onClick={() => signIn("google", { callbackUrl: "/create" })}
    >
      Sign in
    </Button>
  );
}
