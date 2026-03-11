import Link from "next/link";
import Image from "next/image";
import { BookOpen, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] px-4 dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/branding/logo.svg"
          alt="KiddoTales"
          width={64}
          height={64}
          className="mb-6 size-16 object-contain"
        />
        <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Oops! This page got lost in the storybook.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button size="lg">
              <Home className="mr-2 size-5" />
              Go home
            </Button>
          </Link>
          <Link href="/create">
            <Button size="lg" variant="outline">
              <BookOpen className="mr-2 size-5" />
              Create a book
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
