"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 py-6">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4 px-4 text-sm text-muted-foreground">
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        <span className="hidden sm:inline">·</span>
        <span>© {new Date().getFullYear()} KiddoTales</span>
      </div>
    </footer>
  );
}
