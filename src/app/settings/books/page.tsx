"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import ManageBooksPanel from "@/components/settings/manage-books-panel";

export default function ManageBooksPage() {

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Settings">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto px-4 pb-16 pt-4 md:px-8">
        <ManageBooksPanel />
      </main>
    </div>
  );
}
