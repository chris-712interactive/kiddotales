"use client";

import type { BookData } from "@/types";
import { BOOK_HISTORY_KEY, MAX_HISTORY_BOOKS } from "./constants";

/**
 * Saves a book to localStorage history (last 5 books)
 */
export function saveBookToHistory(book: BookData): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(BOOK_HISTORY_KEY);
    const history: BookData[] = stored ? JSON.parse(stored) : [];

    // Add new book at the start, remove duplicates by title+createdAt
    const filtered = history.filter(
      (b) => !(b.title === book.title && b.createdAt === book.createdAt)
    );
    const updated = [book, ...filtered].slice(0, MAX_HISTORY_BOOKS);

    localStorage.setItem(BOOK_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Gets the last 5 books from localStorage
 */
export function getBookHistory(): BookData[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(BOOK_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
