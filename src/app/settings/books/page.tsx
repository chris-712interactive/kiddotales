"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Trash2,
  Loader2,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { toast } from "sonner";
import { PREFETCH_BOOK_KEY_PREFIX } from "@/lib/constants";

type BookItem = {
  id: string;
  title: string;
  createdAt: string;
  coverImageUrl?: string;
  lastOpenedAt?: string | null;
};

function daysSinceOpened(book: BookItem): number {
  const ref = book.lastOpenedAt ? new Date(book.lastOpenedAt) : new Date(book.createdAt);
  return Math.floor((Date.now() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ManageBooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  const fetchBooks = () => {
    Promise.all([
      fetch("/api/user/child-data?all=true").then((r) => (r.ok ? r.json() : { books: [] })),
      fetch("/api/user/settings").then((r) => (r.ok ? r.json() : { profile: {} })),
    ])
      .then(([data, settings]) => {
        setBooks(data.books ?? []);
        setSubscriptionTier(settings?.profile?.subscriptionTier ?? "free");
      })
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleDeleteBook = async (bookId: string) => {
    setDeletingId(bookId);
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Book deleted");
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      } else {
        toast.error(json.error || "Could not delete book");
      }
    } catch {
      toast.error("Could not delete book");
    } finally {
      setDeletingId(null);
    }
  };

  const prefetchBook = (bookId: string) => {
    const key = `${PREFETCH_BOOK_KEY_PREFIX}${bookId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      fetch(`/api/books/${bookId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (b && typeof window !== "undefined") {
            sessionStorage.setItem(key, JSON.stringify(b));
          }
        })
        .catch(() => {});
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("This will permanently delete all your books. This cannot be undone. Continue?")) return;
    setDeleteAllLoading(true);
    try {
      const res = await fetch("/api/user/child-data", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Deleted ${json.deletedBooks} book(s)`);
        setBooks([]);
      } else {
        toast.error(json.error || "Could not delete");
      }
    } catch {
      toast.error("Could not delete books");
    } finally {
      setDeleteAllLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Settings">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Settings</span>
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
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage books</h1>
            <p className="mt-1 text-muted-foreground">
              View, open, or delete your storybooks. You can delete individual books or all of them.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading books…
            </div>
          ) : books.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">You don&apos;t have any books yet.</p>
                <Link href="/create">
                  <Button className="mt-4">Create your first book</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {books.map((book) => (
                  <Card key={book.id} className="overflow-hidden">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {book.coverImageUrl ? (
                          <img
                            src={book.coverImageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <BookOpen className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{book.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(book.createdAt).toLocaleDateString()}
                          {subscriptionTier === "free" && daysSinceOpened(book) >= 30 && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              Not opened in {daysSinceOpened(book)} days – open to keep
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {subscriptionTier === "free" ? (
                          <Link href="/pricing">
                            <Button size="sm" variant="outline" title="Upgrade to correct books" aria-label="Upgrade to correct books">
                              <Pencil className="size-4" />
                            </Button>
                          </Link>
                        ) : (
                          <Link
                            href={`/book?id=${book.id}&correct=1`}
                            onMouseEnter={() => prefetchBook(book.id)}
                            onFocus={() => prefetchBook(book.id)}
                          >
                            <Button size="sm" variant="outline" title="Correct" aria-label="Correct book">
                              <Pencil className="size-4" />
                            </Button>
                          </Link>
                        )}
                        <Link
                          href={`/book?id=${book.id}`}
                          onMouseEnter={() => prefetchBook(book.id)}
                          onFocus={() => prefetchBook(book.id)}
                        >
                          <Button size="sm" variant="outline" title="Open" aria-label={`Open ${book.title}`}>
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === book.id}
                          onClick={() => handleDeleteBook(book.id)}
                          aria-label={`Delete ${book.title}`}
                        >
                          {deletingId === book.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-base">Delete all books</CardTitle>
                  <CardDescription>
                    Permanently remove all your books and child data. This cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    disabled={deleteAllLoading || books.length === 0}
                    onClick={handleDeleteAll}
                  >
                    {deleteAllLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" />
                    )}
                    Delete all {books.length} book{books.length !== 1 ? "s" : ""}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
