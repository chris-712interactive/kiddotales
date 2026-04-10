"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";

function FamilyJoinInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/family-sharing/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not accept invite.");
        return;
      }
      setMessage("success");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex justify-center">
            <Users className="size-12 text-primary" aria-hidden />
          </div>
          <h1 className="text-center text-2xl font-bold text-foreground">
            Family sharing
          </h1>
          {!token ? (
            <p className="mt-4 text-center text-muted-foreground">
              This invite link is missing a token. Ask the plan owner to send the
              link again.
            </p>
          ) : message === "success" ? (
            <p className="mt-4 text-center text-muted-foreground">
              You&apos;re in! You now share the Legend plan benefits and story
              limits with the subscriber.
            </p>
          ) : (
            <>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Accept an invitation to use a household member&apos;s KiddoTales
                Legend plan. Sign in with the <strong>same email</strong> the
                invite was sent to.
              </p>
              {message && (
                <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {message}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3">
                {status === "authenticated" ? (
                  <Button
                    className="w-full"
                    onClick={() => void accept()}
                    disabled={loading || !token}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Accept invite"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() =>
                      signIn("google", {
                        callbackUrl: `/family/join?token=${encodeURIComponent(token)}`,
                      })
                    }
                  >
                    Sign in with Google to accept
                  </Button>
                )}
              </div>
            </>
          )}
          <div className="mt-6 text-center">
            <Link href="/create" className="text-sm text-primary underline">
              Go to create a book
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function FamilyJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <FamilyJoinInner />
    </Suspense>
  );
}
