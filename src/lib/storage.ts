"use client";

import type { BookData, BookPage } from "@/types";
import { BOOK_HISTORY_KEY, MAX_HISTORY_BOOKS } from "./constants";

const DB_NAME = "kiddotales-db";
const DB_VERSION = 1;
const STORE_NAME = "books";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "createdAt" });
    };
  });
}

/** Fetches image URL and returns base64 data URL */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KiddoTales/1.0" },
      mode: "cors",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Converts pages with imageUrl to imageData (base64) for persistence */
async function embedImagesInBook(book: BookData): Promise<BookData> {
  const pages: BookPage[] = [];
  for (const page of book.pages) {
    if (page.imageData) {
      pages.push(page);
      continue;
    }
    if (page.imageUrl) {
      const dataUrl = await fetchImageAsDataUrl(page.imageUrl);
      pages.push({ ...page, imageData: dataUrl ?? undefined });
    } else {
      pages.push(page);
    }
  }

  let coverImageData = book.coverImageData;
  if (!coverImageData && book.coverImageUrl) {
    coverImageData = (await fetchImageAsDataUrl(book.coverImageUrl)) ?? undefined;
  }

  return { ...book, pages, coverImageData };
}

/**
 * Saves a book to IndexedDB history (last 5 books).
 * Fetches images and stores as base64 so they persist past Replicate's 1-hour expiry.
 */
export async function saveBookToHistory(book: BookData): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openDB();

    const bookWithImages = await embedImagesInBook(book);

    const existing = await new Promise<BookData[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });

    const filtered = existing.filter(
      (b) => !(b.title === bookWithImages.title && b.createdAt === bookWithImages.createdAt)
    );
    const updated = [bookWithImages, ...filtered].slice(0, MAX_HISTORY_BOOKS);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      let completed = 0;
      const total = updated.length;
      updated.forEach((b) => {
        const req = tx.objectStore(STORE_NAME).add(b);
        req.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
      });
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch {
    // Fallback to localStorage (URLs only; strip imageData to avoid quota)
    try {
      const bookNoImages: BookData = {
        ...book,
        pages: book.pages.map(({ imageData: _, ...p }) => p),
      };
      const stored = localStorage.getItem(BOOK_HISTORY_KEY);
      const history: BookData[] = stored ? JSON.parse(stored) : [];
      const filtered = history.filter(
        (b) => !(b.title === book.title && b.createdAt === book.createdAt)
      );
      const updated = [bookNoImages, ...filtered].slice(0, MAX_HISTORY_BOOKS);
      localStorage.setItem(BOOK_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
}

/**
 * Gets a single book by createdAt from IndexedDB.
 */
export async function getBookByCreatedAt(createdAt: string): Promise<BookData | null> {
  if (typeof window === "undefined") return null;

  try {
    const db = await openDB();
    const book = await new Promise<BookData | undefined>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(createdAt);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    db.close();
    return book ?? null;
  } catch {
    try {
      const stored = localStorage.getItem(BOOK_HISTORY_KEY);
      const books: BookData[] = stored ? JSON.parse(stored) : [];
      return books.find((b) => b.createdAt === createdAt) ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Gets the last 5 books from IndexedDB (with persisted images).
 */
export async function getBookHistory(): Promise<BookData[]> {
  if (typeof window === "undefined") return [];

  try {
    const db = await openDB();
    const books = await new Promise<BookData[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
    db.close();

    return books
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_HISTORY_BOOKS);
  } catch {
    try {
      const stored = localStorage.getItem(BOOK_HISTORY_KEY);
      const books: BookData[] = stored ? JSON.parse(stored) : [];
      return books
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_HISTORY_BOOKS);
    } catch {
      return [];
    }
  }
}
