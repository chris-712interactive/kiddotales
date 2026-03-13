"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  BookOpen,
  MessageSquare,
  Crown,
  Sparkles,
  Zap,
  UserPlus,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

type BooksByTierDay = { date: string } & Record<string, number>;

type AdminStats = {
  users: { total: number; newThisMonth: number };
  books: { total: number; thisMonth: number };
  tiers: Record<string, number>;
  booksByTierLast30Days: BooksByTierDay[];
  feedback: { total: number; recent: { id: string; message: string; category: string | null; email: string | null; createdAt: string }[] };
  childProfiles: number;
};

function BooksByTierLineChart({
  data,
  tierOrder,
  tierLabels,
}: {
  data: BooksByTierDay[];
  tierOrder: string[];
  tierLabels: Record<string, string>;
}) {
  const hasData = data.some((d) => tierOrder.some((t) => (d[t] ?? 0) > 0));
  if (!hasData) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No books created in the last 30 days.
      </p>
    );
  }

  const colors = ["hsl(var(--primary))", "#f59e0b", "#8b5cf6", "#ec4899"];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            className="text-xs"
          />
          <YAxis allowDecimals={false} className="text-xs" />
          <Tooltip
            labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
            formatter={(value) => [value ?? 0, "Books"]}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend />
          {tierOrder.map((tier, i) => (
            <Line
              key={tier}
              type="monotone"
              dataKey={tier}
              name={tierLabels[tier] ?? tier}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/sign-in?callbackUrl=/admin");
          return null;
        }
        if (res.status === 403) {
          setError("Access denied. Your email is not authorized for the admin portal.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => setError("Failed to load statistics"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading admin dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] px-4">
        <Shield className="size-16 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Access denied</h1>
        <p className="mt-2 text-center text-muted-foreground">{error}</p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Add your email to ADMIN_EMAILS in .env to access the admin portal.
        </p>
        <Link href="/" className="mt-6">
          <Button>Go home</Button>
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  const tierOrder = ["free", "spark", "magic", "legend"];
  const tierLabels: Record<string, string> = {
    free: "Free",
    spark: "Spark",
    magic: "Magic",
    legend: "Legend",
  };
  const tierIcons: Record<string, React.ReactNode> = {
    free: <Sparkles className="size-5" />,
    spark: <Zap className="size-5" />,
    magic: <Sparkles className="size-5" />,
    legend: <Crown className="size-5" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--pastel-pink)] via-background to-[var(--pastel-mint)] dark:from-[var(--pastel-pink)] dark:via-background dark:to-[var(--pastel-mint)]">
      <AppHeader
        pageActions={
          <Link href="/">
            <Button variant="ghost" size="sm" className="size-9 px-2 sm:size-auto sm:px-3" aria-label="Home">
              <ArrowLeft className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Onboarding / Welcome */}
          <section className="rounded-2xl border-2 border-border bg-card p-6 shadow-lg">
            <h1 className="mb-2 text-2xl font-bold text-foreground">Admin Portal</h1>
            <p className="text-muted-foreground">
              Monitor KiddoTales usage, subscriptions, and customer feedback. Data updates when you refresh the page.
            </p>
          </section>

          {/* Stats overview */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/users">
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-5" />
                    Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.users.total}</p>
                  <p className="text-sm text-muted-foreground">
                    +{stats.users.newThisMonth} this month · Manage
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-5" />
                  Books
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.books.total}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.books.thisMonth} created this month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="size-5" />
                  Child profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.childProfiles}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="size-5" />
                  Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.feedback.total}</p>
                <p className="text-sm text-muted-foreground">
                  submissions
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Book creation by license (last 30 days) */}
          <Card>
            <CardHeader>
              <CardTitle>Books created by license type</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <BooksByTierLineChart data={stats.booksByTierLast30Days ?? []} tierOrder={tierOrder} tierLabels={tierLabels} />
            </CardContent>
          </Card>

          {/* Subscription tiers */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription tiers</CardTitle>
              <CardDescription>User count by plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {tierOrder.map((tier) => {
                  const count = stats.tiers[tier] ?? 0;
                  return (
                    <div
                      key={tier}
                      className="flex items-center gap-3 rounded-xl border-2 border-border bg-muted/30 px-4 py-3"
                    >
                      {tierIcons[tier]}
                      <div>
                        <p className="font-semibold">{tierLabels[tier] ?? tier}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Recent feedback</CardTitle>
              <CardDescription>Latest customer submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.feedback.recent.length === 0 ? (
                <p className="text-muted-foreground">No feedback yet.</p>
              ) : (
                <ul className="space-y-4">
                  {stats.feedback.recent.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {f.category && (
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            {f.category}
                          </span>
                        )}
                        {f.email && <span>{f.email}</span>}
                        <span>
                          {new Date(f.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
