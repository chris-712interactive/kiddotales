"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Download,
  Plus,
  RectangleVertical,
  RectangleHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { saveBookToHistory, getBookHistory, getBookByCreatedAt } from "@/lib/storage";
import { toast } from "sonner";
import type { BookData } from "@/types";
import { PENDING_BOOK_KEY } from "@/lib/constants";

function BookViewerContent() {
  const searchParams = useSearchParams();
  const [book, setBook] = useState<BookData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [speakingPage, setSpeakingPage] = useState<number | null>(null);
  const [showOrientationDialog, setShowOrientationDialog] = useState(false);

  useEffect(() => {
    const createdAt = searchParams.get("createdAt");
    const dataParam = searchParams.get("data");

    if (createdAt) {
      getBookByCreatedAt(createdAt).then((b) => setBook(b ?? null));
      return;
    }

    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem(PENDING_BOOK_KEY);
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as BookData;
          sessionStorage.removeItem(PENDING_BOOK_KEY);
          setBook(parsed);
          saveBookToHistory(parsed);
        } catch {
          getBookHistory().then((history) => setBook(history[0] ?? null));
        }
        return;
      }
    }

    if (dataParam && dataParam.length < 8000) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam)) as BookData;
        setBook(parsed);
        saveBookToHistory(parsed);
      } catch {
        getBookHistory().then((history) => setBook(history[0] ?? null));
      }
      return;
    }

    if (typeof window !== "undefined") {
      getBookHistory().then((history) => setBook(history[0] ?? null));
    }
  }, [searchParams]);

  const handleReadAloud = useCallback(
    (pageIndex: number) => {
      if (!book) return;

      if (speakingPage === pageIndex) {
        window.speechSynthesis?.cancel();
        setSpeakingPage(null);
        return;
      }

      window.speechSynthesis?.cancel();
      const utterance = new SpeechSynthesisUtterance(book.pages[pageIndex].text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const kidVoice = voices.find((v) => v.name.includes("Child") || v.name.includes("Samantha"));
      if (kidVoice) utterance.voice = kidVoice;

      utterance.onend = () => setSpeakingPage(null);
      utterance.onerror = () => setSpeakingPage(null);

      window.speechSynthesis.speak(utterance);
      setSpeakingPage(pageIndex);
    },
    [book, speakingPage]
  );

  const handleDownloadPDF = useCallback(
    async (orientation: "portrait" | "landscape") => {
      if (!book) return;
      setShowOrientationDialog(false);
      setIsDownloading(true);
      try {
        const res = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book, orientation }),
        });
        if (!res.ok) throw new Error("Failed to generate PDF");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${book.title.replace(/\s+/g, "-")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded!");
      } catch (err) {
        toast.error("Failed to generate PDF.");
      } finally {
        setIsDownloading(false);
      }
    },
    [book]
  );

  if (!book) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">No book found. Create one first!</p>
        <Link href="/create">
          <Button>
            <Plus className="mr-2 size-4" />
            Create Your Book
          </Button>
        </Link>
      </div>
    );
  }

  const totalPages = book.pages.length;
  const page = book.pages[currentPage];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
        <Image
            src="/branding/logo.svg"
            alt="KiddoTales"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="text-xl font-bold">KiddoTales</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOrientationDialog(true)}
            disabled={isDownloading}
          >
            <Download className="mr-1 size-4" />
            {isDownloading ? "Generating..." : "Download PDF"}
          </Button>
          <Link href="/create">
            <Button variant="secondary" size="sm">
              <Plus className="mr-1 size-4" />
              Make another book
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">
          {book.title}
        </h1>

        {/* Book viewer - horizontal carousel */}
        <motion.div
          className="relative"
          initial={false}
          drag={isMobile ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            const threshold = 50;
            if (info.offset.x > threshold && currentPage > 0) {
              setCurrentPage((p) => p - 1);
            } else if (info.offset.x < -threshold && currentPage < totalPages - 1) {
              setCurrentPage((p) => p + 1);
            }
          }}
        >
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-full"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="size-6" />
            </Button>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                className="flex flex-col items-center"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-xl shadow-black/10">
                  {(page.imageData || page.imageUrl) ? (
                    <img
                      src={page.imageData || page.imageUrl}
                      alt={`Page ${currentPage + 1}`}
                      className="w-full object-cover book-page-image"
                    />
                  ) : (
                    <div className="flex h-[300px] w-full items-center justify-center bg-muted md:h-[400px] md:w-[500px]">
                      <BookOpen className="size-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-6">
                    <p className="text-center text-lg leading-relaxed text-foreground">
                      {page.text}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleReadAloud(currentPage)}
                >
                  <Volume2
                    className={`mr-2 size-4 ${speakingPage === currentPage ? "text-primary" : ""}`}
                  />
                  {speakingPage === currentPage ? "Stop" : "Read aloud"}
                </Button>
              </motion.div>
            </AnimatePresence>

            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-full"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="size-6" />
            </Button>
          </div>
        </motion.div>

        {/* Orientation dialog */}
        <AnimatePresence>
          {showOrientationDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowOrientationDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl border-2 border-border bg-card p-6 shadow-xl"
              >
                <h3 className="mb-4 text-center text-lg font-semibold text-foreground">
                  Choose PDF orientation
                </h3>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex flex-1 flex-col gap-2 py-6"
                    onClick={() => handleDownloadPDF("portrait")}
                  >
                    <RectangleVertical className="size-10 text-primary" />
                    <span>Portrait</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-1 flex-col gap-2 py-6"
                    onClick={() => handleDownloadPDF("landscape")}
                  >
                    <RectangleHorizontal className="size-10 text-primary" />
                    <span>Landscape</span>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => setShowOrientationDialog(false)}
                >
                  Cancel
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page indicator */}
        <div className="mt-6 flex justify-center gap-2">
          {book.pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentPage
                  ? "w-8 bg-primary"
                  : "w-2 bg-primary/30 hover:bg-primary/50"
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <BookViewerContent />
    </Suspense>
  );
}
