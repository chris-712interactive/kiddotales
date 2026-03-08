"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
import { getBookHistory } from "@/lib/storage";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { BookData } from "@/types";

const TESTIMONIALS = [
  {
    quote: "My 4-year-old asks for 'her' story every night now. Pure magic!",
    author: "Sarah M.",
    emoji: "✨",
  },
  {
    quote: "Finally, bedtime stories that feature MY kid. Game changer.",
    author: "David L.",
    emoji: "🌟",
  },
  {
    quote: "The illustrations are gorgeous. We printed ours and it's on the shelf!",
    author: "Emma K.",
    emoji: "📚",
  },
];

export default function LandingPage() {
  const [history, setHistory] = useState<BookData[]>([]);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([
        fetch("/api/books").then((r) => (r.ok ? r.json() : [])),
        getBookHistory(),
      ])
        .then(([apiBooks, localBooks]) => {
          const api = Array.isArray(apiBooks) ? apiBooks : [];
          const local = Array.isArray(localBooks) ? localBooks : [];
          const seen = new Set<string>();
          const merged: BookData[] = [];
          for (const b of [...api, ...local]) {
            const key = b.id ?? b.createdAt;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(b);
            }
          }
          merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setHistory(merged.slice(0, 10));
        })
        .catch(() => getBookHistory().then(setHistory));
    } else {
      getBookHistory().then(setHistory);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold text-foreground">KiddoTales</span>
        </Link>
        <div className="flex items-center gap-2">
          <AuthButtons />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 md:px-8">
        {/* Hero */}
        <motion.section
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Cute illustration placeholder - sparkles and book */}
          <motion.div
            className="mb-6 flex items-center justify-center gap-4"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="size-12 text-yellow-500" />
            <div className="rounded-2xl bg-primary/20 p-6 shadow-xl loading-book-container">
              <BookOpen className="size-24 loading-book-icon" />
            </div>
            <Sparkles className="size-12 text-yellow-500" />
          </motion.div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Turn 60 seconds into{" "}
            <span className="text-primary">bedtime magic</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Create personalized storybooks starring your child. Just fill in a
            few details, and we&apos;ll weave a unique tale with beautiful
            illustrations—ready in minutes.
          </p>

          <motion.div
            className="flex flex-col items-center gap-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link href="/create">
              <Button size="lg" className="text-lg">
                <BookOpen className="mr-2 size-5" />
                Create Your Book
              </Button>
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              View plans & pricing
            </Link>
          </motion.div>
        </motion.section>

        {/* Testimonials */}
        <motion.section
          className="mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">
            Parents love it
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.author}
                className="rounded-2xl border-2 border-border bg-card p-6 shadow-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                whileHover={{ y: -4, boxShadow: "0 20px 40px -15px rgba(0,0,0,0.1)" }}
              >
                <p className="mb-4 text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">— {t.author}</span>
                  <span className="text-2xl">{t.emoji}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Recent books */}
        {history.length > 0 && (
          <motion.section
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="mb-4 text-center text-2xl font-semibold text-foreground">
              Your recent books
            </h2>
            <div className="flex flex-wrap justify-start gap-5">
              {history.map((book) => (
                <Link 
                  key={book.id ?? book.createdAt} 
                  href={book.id ? `/book?id=${book.id}` : `/book?createdAt=${encodeURIComponent(book.createdAt)}`}
                  className="w-full"
                >
                  <motion.div
                    className="flex flex-row items-center overflow-hidden rounded-xl border-2 border-border bg-card shadow-md w-full"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {(book.coverImageData || book.coverImageUrl) ? (
                      <div className="relative h-24 w-32 overflow-hidden bg-muted">
                        <img
                          src={book.coverImageData || book.coverImageUrl!}
                          alt={book.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <span className="px-4 py-3 font-medium">{book.title}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}
