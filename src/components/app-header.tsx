"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, BookOpen, Home, BookMarked, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthButtons } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "next-auth/react";

interface AppHeaderProps {
  /** Page-specific actions shown in the header next to the hamburger (e.g. Back, Correct, Download PDF) */
  pageActions?: React.ReactNode;
  className?: string;
}

export function AppHeader({ pageActions, className }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!session?.user) {
      setUnreadCount(0);
      return;
    }

    let mounted = true;
    const loadNotifications = () => {
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { notifications: [] }))
        .then((data) => {
          if (!mounted) return;
          const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
          setUnreadCount(notifications.length);
        })
        .catch(() => {
          if (mounted) setUnreadCount(0);
        });
    };

    loadNotifications();
    const id = window.setInterval(loadNotifications, 60000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [session?.user]);

  return (
    <>
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-4 md:px-8",
          className
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold text-foreground">KiddoTales</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          {pageActions}
          <Button
            variant="ghost"
            size="icon"
            className="relative size-10 shrink-0"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-6" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <span className="text-lg font-semibold">Menu</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </Button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
                <Link href="/" className="block w-full" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Home className="mr-2 size-4" />
                    Home
                  </Button>
                </Link>
                <Link href="/create" className="block w-full" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <BookOpen className="mr-2 size-4" />
                    Create a book
                  </Button>
                </Link>
                {session?.user ? (
                  <Link href="/messages" className="block w-full" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <Bell className="mr-2 size-4" />
                      Message Center
                      {unreadCount > 0 ? (
                        <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                          {unreadCount}
                        </span>
                      ) : null}
                    </Button>
                  </Link>
                ) : null}
                <AuthButtons variant="drawer" setOpen={setOpen} />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
