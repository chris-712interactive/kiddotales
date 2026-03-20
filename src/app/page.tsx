"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Zap,
  Crown,
  Settings,
  CreditCard,
  Calendar,
  Loader2,
  ExternalLink,
  Volume2,
  Shield,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { getBookHistory } from "@/lib/storage";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { BookData } from "@/types";
import { SUBSCRIPTION_TIERS } from "@/lib/stripe";
import UnauthenticatedLanding from "@/components/landing/UnauthenticatedLanding";
import { LandingThemeLock } from "@/components/landing/landing-theme-lock";

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Sparkles className="size-5" />,
  spark: <Zap className="size-5" />,
  magic: <Sparkles className="size-5" />,
  legend: <Crown className="size-5" />,
};

type DashboardData = {
  bookCount: number;
  bookLimit: number;
  bookLimitPeriod: "total" | "monthly";
  voiceCount?: number;
  voiceLimit?: number;
  subscriptionTier: string;
  nextBillingDate: string | null;
  cancelAtPeriodEnd?: boolean;
  displayName?: string | null;
  isAdmin?: boolean;
  isAffiliate?: boolean;
};

function DashboardView({
  data,
  history,
}: {
  data: DashboardData;
  history: BookData[];
}) {
  const tierConfig = SUBSCRIPTION_TIERS[data.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS] ?? SUBSCRIPTION_TIERS.free;
  const usageLabel =
    data.bookLimitPeriod === "monthly" ? "this month" : "total";
  const nextChargeLabel = data.cancelAtPeriodEnd
    ? "Access until"
    : "Next charge";

  return (
    <div className="space-y-8">
      {/* Welcome + Create CTA */}
      <motion.section
        className="flex flex-col items-center rounded-2xl border-2 border-border bg-card p-8 shadow-lg md:flex-row md:justify-between md:gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6 text-center md:mb-0 md:text-left">
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
            Welcome back{data.displayName ? `, ${data.displayName}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            Ready to create another bedtime story?
          </p>
        </div>
        <Link href="/create" className="shrink-0">
          <Button size="lg" className="text-lg">
            <BookOpen className="mr-2 size-5" />
            Create a book
          </Button>
        </Link>
      </motion.section>

      {/* Quick links */}
      <motion.section
        className="flex flex-wrap gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <Settings className="mr-1 size-4" />
            Settings
          </Button>
        </Link>
        <Link href="/settings/books">
          <Button variant="outline" size="sm">
            <BookOpen className="mr-1 size-4" />
            My books
          </Button>
        </Link>
        <Link href="/pricing">
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-1 size-4" />
            Plans & pricing
          </Button>
        </Link>
        {data.isAffiliate && (
          <Link href="/affiliate">
            <Button variant="outline" size="sm">
              <Link2 className="mr-1 size-4" />
              Affiliate
            </Button>
          </Link>
        )}
        {data.isAdmin && (
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <Shield className="mr-1 size-4" />
              Admin
            </Button>
          </Link>
        )}
      </motion.section>

      {/* Stats cards */}
      <motion.section
        className="grid gap-4 sm:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <BookOpen className="size-5" />
            <span className="text-sm font-medium">Usage</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {data.bookCount} / {data.bookLimit}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            books {usageLabel}
          </p>
        </div>

        {typeof data.voiceLimit === "number" && data.voiceLimit > 0 && (
          <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Volume2 className="size-5" />
              <span className="text-sm font-medium">AI voice</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(data.voiceCount ?? 0)} / {data.voiceLimit}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              books with AI voice {usageLabel}
            </p>
          </div>
        )}

        <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            {TIER_ICONS[data.subscriptionTier] ?? TIER_ICONS.free}
            <span className="text-sm font-medium">Plan</span>
          </div>
          <p className="text-2xl font-bold text-foreground capitalize">
            {tierConfig.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.bookLimit} books {usageLabel}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-5" />
            <span className="text-sm font-medium">
              {data.subscriptionTier === "free" ? "Upgrade" : nextChargeLabel}
            </span>
          </div>
          {data.subscriptionTier === "free" ? (
            <>
              <p className="text-lg font-semibold text-foreground">
                Get more stories
              </p>
              <Link href="/pricing" className="mt-2 inline-block">
                <Button size="sm" variant="outline">
                  View plans
                </Button>
              </Link>
            </>
          ) : data.nextBillingDate ? (
            <>
              <p className="text-2xl font-bold text-foreground">
                {new Date(data.nextBillingDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <Link href="/settings" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <CreditCard className="size-4" />
                Manage billing
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
      </motion.section>

      {/* Recent books */}
      {history.length === 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Your recent books
          </h2>
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
            <BookOpen className="mb-4 size-16 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium text-foreground">
              No books yet
            </p>
            <p className="mb-6 text-muted-foreground">
              Create your first personalized storybook and it will appear here.
            </p>
            <Link href="/create">
              <Button size="lg">
                <BookOpen className="mr-2 size-5" />
                Create your first book
              </Button>
            </Link>
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Your recent books
          </h2>
          <div className="flex flex-wrap gap-4">
            {history.map((book) => (
              <Link
                key={book.id ?? book.createdAt}
                href={
                  book.id
                    ? `/book?id=${book.id}`
                    : `/book?createdAt=${encodeURIComponent(book.createdAt)}`
                }
                className="w-full min-w-0 sm:w-auto sm:min-w-[200px]"
              >
                <motion.div
                  className="flex flex-row items-center overflow-hidden rounded-xl border-2 border-border bg-card shadow-md transition-shadow hover:shadow-lg sm:flex-col sm:items-stretch"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {(book.coverImageData || book.coverImageUrl) ? (
                    <div className="relative h-24 w-32 shrink-0 overflow-hidden bg-muted sm:h-32 sm:w-full">
                      <img
                        src={book.coverImageData || book.coverImageUrl!}
                        alt={book.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-32 shrink-0 items-center justify-center bg-muted sm:h-32 sm:w-full">
                      <BookOpen className="size-12 text-muted-foreground" />
                    </div>
                  )}
                  <span className="px-4 py-3 font-medium sm:px-3 sm:py-2 sm:text-center">
                    {book.title}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [history, setHistory] = useState<BookData[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const { data: session, status } = useSession();

  const fetchHistory = () => {
    if (status === "authenticated") {
      Promise.all([
        fetch("/api/books").then((r) => (r.ok ? r.json() : [])),
        getBookHistory(),
      ])
        .then(([apiBooks, localBooks]) => {
          const api = Array.isArray(apiBooks) ? apiBooks : [];
          const local = Array.isArray(localBooks) ? localBooks : [];
          const seen = new Set<string>();
          const merged: BookData[] = [];
          for (const b of [...api, ...local]) {
            const key = b.id ?? b.createdAt;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(b);
            }
          }
          merged.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setHistory(merged.slice(0, 10));
        })
        .catch(() => getBookHistory().then(setHistory));
    } else {
      getBookHistory().then(setHistory);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      setDashboardLoading(true);
      fetch("/api/user/settings")
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res) {
            setDashboardData({
              bookCount: res.bookCount ?? 0,
              bookLimit: res.bookLimit ?? 3,
              bookLimitPeriod: res.bookLimitPeriod ?? "total",
              voiceCount: res.voiceCount ?? 0,
              voiceLimit: res.voiceLimit ?? 0,
              subscriptionTier: res.subscriptionTier ?? "free",
              nextBillingDate: res.nextBillingDate ?? null,
              cancelAtPeriodEnd: res.cancelAtPeriodEnd ?? false,
              displayName: res.profile?.displayName ?? res.profile?.name ?? null,
              isAdmin: res.isAdmin ?? false,
              isAffiliate: res.isAffiliate ?? false,
            });
          }
        })
        .catch(() => {})
        .finally(() => setDashboardLoading(false));
    } else {
      setDashboardData(null);
      setDashboardLoading(false);
    }
  }, [status]);

  const isAuthenticated = status === "authenticated";
  const showDashboard = isAuthenticated;
  const dashboardDataResolved =
    dashboardData ?? (isAuthenticated
      ? {
          bookCount: 0,
          bookLimit: 3,
          bookLimitPeriod: "total" as const,
          voiceCount: 0,
          voiceLimit: 0,
          subscriptionTier: "free",
          nextBillingDate: null,
          cancelAtPeriodEnd: false,
          isAdmin: false,
          isAffiliate: false,
        }
      : null);

  return (
    <div
      className={
        showDashboard
          ? "min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]"
          : "min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]"
      }
    >
      {!showDashboard && <LandingThemeLock />}
      <AppHeader />

      <main
        className={`mx-auto ${
          showDashboard ? "max-w-4xl" : "max-w-6xl"
        } px-4 pb-16 pt-8 md:px-8`}
      >
        {showDashboard ? (
          <>
            {dashboardLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span>Loading dashboard…</span>
              </div>
            ) : (
              <DashboardView
                data={dashboardDataResolved!}
                history={history}
              />
            )}
          </>
        ) : (
          <>
            <UnauthenticatedLanding />
          </>
        )}
      </main>
    </div>
  );
}
