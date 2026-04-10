"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-6 text-green-600" />
            Thank you!
          </CardTitle>
          <CardDescription>
            Your payment was received. We&apos;re preparing your files and submitting the order to our
            print partner. You&apos;ll get email updates from the carrier when it ships.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionId && (
            <p className="text-xs text-muted-foreground break-all">
              Reference: {sessionId}
            </p>
          )}
          <Link href="/settings">
            <Button variant="outline">Back to settings</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PrintSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-mint)]/40 via-background to-background">
      <AppHeader />
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </div>
  );
}
