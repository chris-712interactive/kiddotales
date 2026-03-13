"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBookToHistory, getBookHistory, getBookByCreatedAt } from "@/lib/storage";
import { toast } from "sonner";
import type { BookData } from "@/types";
import { CorrectionModal } from "@/components/correction-modal";
import { AppHeader } from "@/components/app-header";
import { useSession } from "next-auth/react";
import { PENDING_BOOK_KEY, PREFETCH_BOOK_KEY_PREFIX } from "@/lib/constants";

function BookViewerContent() {
  const searchParams = useSearchParams();
  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [speakingPage, setSpeakingPage] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showOrientationDialog, setShowOrientationDialog] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [deferredCorrectFromUrl, setDeferredCorrectFromUrl] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/settings")
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => res && setSubscriptionTier(res.subscriptionTier ?? "free"))
        .catch(() => setSubscriptionTier("free"));
    } else {
      setSubscriptionTier(null);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!deferredCorrectFromUrl || !book?.id || !session?.user) return;
    if (subscriptionTier === "free") {
      toast.error("Upgrade your plan to correct books.");
      setDeferredCorrectFromUrl(false);
    } else if (subscriptionTier) {
      setShowCorrectionModal(true);
      setDeferredCorrectFromUrl(false);
    }
  }, [deferredCorrectFromUrl, book?.id, session?.user, subscriptionTier]);

  useEffect(() => {
    let cancelled = false;

    // Use URL as source of truth for id (avoids searchParams race on client nav)
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const bookId = searchParams.get("id") ?? urlParams?.get("id") ?? null;
    const createdAt = searchParams.get("createdAt") ?? urlParams?.get("createdAt") ?? null;
    const dataParam = searchParams.get("data") ?? urlParams?.get("data") ?? null;

    if (bookId) {
      // Use sessionStorage first for just-created or prefetched books (instant display)
      if (typeof window !== "undefined") {
        const pending = sessionStorage.getItem(PENDING_BOOK_KEY);
        if (pending) {
          try {
            const parsed = JSON.parse(pending) as BookData;
            if (parsed.id === bookId) {
              setBook(parsed);
              setLoading(false);
              saveBookToHistory(parsed).finally(() => {
                sessionStorage.removeItem(PENDING_BOOK_KEY);
              });
              return () => { cancelled = true; };
            }
          } catch {
            sessionStorage.removeItem(PENDING_BOOK_KEY);
          }
        }
        const prefetched = sessionStorage.getItem(`${PREFETCH_BOOK_KEY_PREFIX}${bookId}`);
        if (prefetched) {
          try {
            const parsed = JSON.parse(prefetched) as BookData;
            if (parsed.id === bookId) {
              setBook(parsed);
              setLoading(false);
              sessionStorage.removeItem(`${PREFETCH_BOOK_KEY_PREFIX}${bookId}`);
              if (urlParams?.get("correct") === "1") setDeferredCorrectFromUrl(true);
              return () => { cancelled = true; };
            }
          } catch {
            sessionStorage.removeItem(`${PREFETCH_BOOK_KEY_PREFIX}${bookId}`);
          }
        }
      }
      // Fallback: fetch from API (for cross-device or direct links)
      setLoading(true);
      fetch(`/api/books/${bookId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (!cancelled) {
            setBook(b ?? null);
            setLoading(false);
            if (urlParams?.get("correct") === "1") setDeferredCorrectFromUrl(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBook(null);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }

    if (createdAt) {
      setLoading(true);
      getBookByCreatedAt(createdAt)
        .then((b) => {
          if (!cancelled) {
            setBook(b ?? null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBook(null);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }

    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem(PENDING_BOOK_KEY);
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as BookData;
          setBook(parsed);
          setLoading(false);
          saveBookToHistory(parsed).finally(() => {
            sessionStorage.removeItem(PENDING_BOOK_KEY);
          });
          return () => { cancelled = true; };
        } catch {
          sessionStorage.removeItem(PENDING_BOOK_KEY);
          setLoading(true);
          getBookHistory()
            .then((history) => {
              if (!cancelled) {
                setBook(history[0] ?? null);
                setLoading(false);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setBook(null);
                setLoading(false);
              }
            });
        }
        return () => { cancelled = true; };
      }
    }

    if (dataParam && dataParam.length < 8000) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam)) as BookData;
        setBook(parsed);
        setLoading(false);
        saveBookToHistory(parsed);
        return () => { cancelled = true; };
      } catch {
        setLoading(true);
        getBookHistory()
          .then((history) => {
            if (!cancelled) {
              setBook(history[0] ?? null);
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setBook(null);
              setLoading(false);
            }
          });
      }
      return () => { cancelled = true; };
    }

    if (typeof window !== "undefined") {
      setLoading(true);
      getBookHistory()
        .then((history) => {
          if (!cancelled) {
            setBook(history[0] ?? null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBook(null);
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [searchParams]);

  const handleReadAloud = useCallback(
    async (pageIndex: number) => {
      if (!book) return;

      if (speakingPage === pageIndex) {
        window.speechSynthesis?.cancel();
        audioRef.current?.pause();
        setSpeakingPage(null);
        return;
      }

      const page = book.pages[pageIndex];
      const text = page?.text?.trim();
      if (!text) return;

      const hasCachedAudio = page?.audioUrl;

      if (hasCachedAudio) {
        window.speechSynthesis?.cancel();
        const audio = new Audio(page.audioUrl);
        audioRef.current = audio;
        setSpeakingPage(pageIndex);
        audio.onended = () => setSpeakingPage(null);
        audio.onerror = () => {
          setSpeakingPage(null);
          toast.error("Could not play audio.");
        };
        audio.play().catch(() => {
          setSpeakingPage(null);
          toast.error("Could not play audio.");
        });
        return;
      }

      // No pre-created AI audio: use browser TTS (no on-demand AI generation)
      window.speechSynthesis?.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
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

  // If URL has ?id= but we don't have book yet, show loading (handles searchParams race on nav)
  const hasIdInUrl =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("id");

  if (loading || (!book && hasIdInUrl)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading your book…</p>
      </div>
    );
  }

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

  const hasDedication = Boolean(book.dedication?.message || book.dedication?.from);
  const totalPages = hasDedication ? 1 + book.pages.length : book.pages.length;
  const isDedicationPage = hasDedication && currentPage === 0;
  const page = isDedicationPage ? null : book.pages[hasDedication ? currentPage - 1 : currentPage];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <>
            {session?.user && book.id && (
              subscriptionTier === "free" ? (
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" title="Upgrade to correct books" aria-label="Upgrade to correct books">
                    <Pencil className="size-4 sm:mr-1" />
                    <span className="hidden sm:inline">Upgrade</span>
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="size-9 px-2 sm:size-auto sm:px-3"
                  onClick={() => setShowCorrectionModal(true)}
                  aria-label="Correct book"
                >
                  <Pencil className="size-4 sm:mr-1" />
                  <span className="hidden sm:inline">Correct</span>
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              className="size-9 px-2 sm:size-auto sm:px-3"
              onClick={() => setShowOrientationDialog(true)}
              disabled={isDownloading}
              aria-label={isDownloading ? "Generating PDF" : "Download PDF"}
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin sm:mr-1" />
              ) : (
                <Download className="size-4 sm:mr-1" />
              )}
              <span className="hidden sm:inline">{isDownloading ? "Generating..." : "PDF"}</span>
            </Button>
            <Link href="/create">
              <Button variant="secondary" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Make another book">
                <Plus className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">New book</span>
              </Button>
            </Link>
          </>
        }
      />

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
              aria-label="Previous page"
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
                {isDedicationPage && book.dedication ? (
                  <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-xl shadow-black/10 md:w-[500px]">
                    <div className="flex min-h-[300px] flex-col items-center justify-center p-8 md:min-h-[400px]">
                      <p className="text-center text-xl leading-relaxed text-foreground">
                        {book.dedication.message}
                      </p>
                      {book.dedication.from && (
                        <p className="mt-4 text-center text-sm italic text-muted-foreground">
                          — {book.dedication.from}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-xl shadow-black/10">
                      {(page?.imageData || page?.imageUrl) ? (
                        <img
                          src={page?.imageData || page?.imageUrl}
                          alt={`Page ${(hasDedication ? currentPage : currentPage + 1)}`}
                          className="w-full object-cover book-page-image"
                        />
                      ) : (
                        <div className="flex h-[300px] w-full items-center justify-center bg-muted md:h-[400px] md:w-[500px]">
                          <BookOpen className="size-16 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-6">
                        <p className="text-center text-lg leading-relaxed text-foreground">
                          {page?.text}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4"
                      onClick={() => handleReadAloud(hasDedication ? currentPage - 1 : currentPage)}
                    >
                      <Volume2
                        className={`mr-2 size-4 ${speakingPage === (hasDedication ? currentPage - 1 : currentPage) ? "text-primary" : ""}`}
                      />
                      {speakingPage === (hasDedication ? currentPage - 1 : currentPage) ? "Stop" : "Read aloud"}
                    </Button>
                  </>
                )}
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
              aria-label="Next page"
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
                role="dialog"
                aria-modal="true"
                aria-labelledby="orientation-dialog-title"
              >
                <h3 id="orientation-dialog-title" className="mb-4 text-center text-lg font-semibold text-foreground">
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

        {/* Correction modal */}
        {showCorrectionModal && book.id && (
          <CorrectionModal
            book={{
              id: book.id,
              title: book.title,
              pages: book.pages,
              creationMetadata: book.creationMetadata,
            }}
            onClose={() => setShowCorrectionModal(false)}
            onSuccess={(updated) => {
              setBook({
                ...book,
                ...updated,
                pages: updated.pages ?? book.pages,
                creationMetadata: updated.creationMetadata ?? book.creationMetadata,
              });
              setShowCorrectionModal(false);
            }}
          />
        )}

        {/* Page indicator */}
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
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
