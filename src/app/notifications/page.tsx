"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Bell, BookOpen, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";

type Notification = {
  type: "book_inactivity_warning";
  bookId: string;
  bookTitle: string;
  daysSinceOpened: number;
  deletionInDays: number;
};

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setLoading(true);
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { notifications: [] }))
        .then((data) => setNotifications(data.notifications ?? []))
        .catch(() => setNotifications([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setNotifications([]);
    }
  }, [status, session?.user]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <p className="text-muted-foreground">Sign in to view notifications.</p>
        <Link href="/sign-in?callbackUrl=/notifications">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Home">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                Retention warnings for your books
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading…</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
              <Bell className="mx-auto mb-4 size-12 text-muted-foreground/50" />
              <p className="font-medium text-foreground">No notifications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll notify you here if any of your books are at risk of being removed due to inactivity.
              </p>
              <Link href="/settings/books" className="mt-6 inline-block">
                <Button variant="outline">Manage books</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li key={`${n.bookId}-${n.daysSinceOpened}`}>
                    <Link
                      href={`/book?id=${n.bookId}`}
                      className="block overflow-hidden rounded-xl border-2 border-border bg-card transition-colors hover:border-primary/50 hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-4 p-4">
                        <BookOpen className="mt-0.5 size-5 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {n.bookTitle}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Not opened in {n.daysSinceOpened} days.{" "}
                            {n.deletionInDays > 0 ? (
                              <>Will be removed in {n.deletionInDays} days if not opened.</>
                            ) : (
                              <>May be removed soon.</>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/settings/books" className="block">
                <Button variant="outline" className="w-full">
                  Manage all books
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
