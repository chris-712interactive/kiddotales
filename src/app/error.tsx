"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[KiddoTales] Error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] px-4 dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <div className="flex flex-col items-center text-center">
        <AlertCircle className="mb-6 size-16 text-destructive" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          We&apos;re sorry, but something unexpected happened. Please try again.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <Link href="/">
            <Button size="lg" variant="outline">
              <Home className="mr-2 size-5" />
              Go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
