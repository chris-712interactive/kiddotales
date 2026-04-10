"use client";

import Link from "next/link";
import { FeedbackTrigger } from "./feedback-trigger";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-6">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-sm text-muted-foreground sm:gap-4">
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        <span className="hidden sm:inline">·</span>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>
        <span className="hidden sm:inline">·</span>
        <FeedbackTrigger variant="link" />
        <span className="hidden sm:inline">·</span>
        <Link href="/affiliate" className="underline hover:text-foreground">
          Affiliate program
        </Link>
        <span className="hidden sm:inline">·</span>
        <span>© {new Date().getFullYear()} KiddoTales</span>
      </div>
    </footer>
  );
}
