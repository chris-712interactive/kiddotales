"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, BookOpen, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";

type Notification = {
  type: "book_inactivity_warning";
  bookId: string;
  bookTitle: string;
  daysSinceOpened: number;
  deletionInDays: number;
};

export function NotificationCenter() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setLoading(true);
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { notifications: [] }))
        .then((data) => setNotifications(data.notifications ?? []))
        .catch(() => setNotifications([]))
        .finally(() => setLoading(false));
    } else {
      setNotifications([]);
    }
  }, [status, session?.user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status !== "authenticated" || !session?.user) return null;

  const count = notifications.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Notifications"
        aria-label={count > 0 ? `${count} notifications` : "Notifications"}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border-2 border-border bg-card shadow-xl">
          <div className="border-b border-border bg-muted/50 px-4 py-3">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              Retention warnings for your books
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={`${n.bookId}-${n.daysSinceOpened}`}>
                    <Link
                      href={`/book?id=${n.bookId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/50"
                    >
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {n.bookTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Not opened in {n.daysSinceOpened} days.{" "}
                          {n.deletionInDays > 0 ? (
                            <>Will be removed in {n.deletionInDays} days if not opened.</>
                          ) : (
                            <>May be removed soon.</>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="border-t border-border p-2">
              <Link
                href="/settings/books"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-center text-sm font-medium text-primary hover:bg-primary/10"
              >
                Manage all books
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
