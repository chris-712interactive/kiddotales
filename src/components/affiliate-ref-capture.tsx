"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const AFFILIATE_STORAGE_KEY = "kiddotales_affiliate";
const AFFILIATE_DAYS = parseInt(process.env.NEXT_PUBLIC_AFFILIATE_COOKIE_DAYS ?? "30", 10);

function getStored(): { code: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AFFILIATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; expiresAt?: number };
    if (!parsed?.code || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(AFFILIATE_STORAGE_KEY);
      return null;
    }
    return { code: parsed.code, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function storeAffiliateCode(code: string): void {
  if (typeof window === "undefined") return;
  const trimmed = code?.trim()?.toUpperCase();
  if (!trimmed) return;
  const expiresAt = Date.now() + AFFILIATE_DAYS * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify({ code: trimmed, expiresAt }));
  } catch {
    // ignore
  }
}

export function getAffiliateCode(): string | null {
  return getStored()?.code ?? null;
}

export function clearAffiliateCode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Client component: capture ?ref=CODE from URL and store in localStorage. */
export function AffiliateRefCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      storeAffiliateCode(ref.trim());
    }
  }, [searchParams]);

  return null;
}
