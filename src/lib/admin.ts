/**
 * Admin authorization and stats helpers.
 * Admins are defined via ADMIN_EMAILS env var (comma-separated).
 */

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = process.env.ADMIN_EMAILS;
  if (!allowed) return false;
  const emails = allowed.split(",").map((e) => e.trim().toLowerCase());
  return emails.includes(email.toLowerCase());
}

import { createSupabaseAdmin } from "./supabase";

export async function getAdminStats() {
  const supabase = createSupabaseAdmin();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStartStr = monthStart.toISOString();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Users
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });
  const { count: newUsersThisMonth } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStartStr);

  // Books
  const { count: totalBooks } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true });
  const { count: booksThisMonth } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStartStr);

  // Subscription tiers
  const { data: tierData } = await supabase
    .from("users")
    .select("subscription_tier");
  const tierCounts: Record<string, number> = {};
  for (const row of tierData ?? []) {
    const tier = row.subscription_tier ?? "free";
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }

  // Feedback
  const { count: totalFeedback } = await supabase
    .from("feedback")
    .select("*", { count: "exact", head: true });
  const { data: recentFeedback } = await supabase
    .from("feedback")
    .select("id, message, category, email, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Child profiles
  const { count: totalProfiles } = await supabase
    .from("child_profiles")
    .select("*", { count: "exact", head: true });

  // Books by subscription tier by day (last 30 days) - for line chart
  const { data: booksLast30 } = await supabase
    .from("books")
    .select("created_at, users!inner(subscription_tier)")
    .gte("created_at", thirtyDaysAgoStr);
  const tierOrder = ["free", "spark", "magic", "legend"];
  const byDate: Record<string, Record<string, number>> = {};
  for (let d = 0; d <= 30; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() - (30 - d));
    const key = day.toISOString().slice(0, 10);
    byDate[key] = Object.fromEntries(tierOrder.map((t) => [t, 0]));
  }
  for (const row of booksLast30 ?? []) {
    const tier = (row.users as { subscription_tier?: string } | null)?.subscription_tier ?? "free";
    const key = (row.created_at as string).slice(0, 10);
    if (byDate[key] && (tierOrder.includes(tier) || tier)) {
      byDate[key][tier] = (byDate[key][tier] ?? 0) + 1;
    }
  }
  const booksByTierLast30Days = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  return {
    users: {
      total: totalUsers ?? 0,
      newThisMonth: newUsersThisMonth ?? 0,
    },
    books: {
      total: totalBooks ?? 0,
      thisMonth: booksThisMonth ?? 0,
    },
    tiers: tierCounts,
    booksByTierLast30Days,
    feedback: {
      total: totalFeedback ?? 0,
      recent: (recentFeedback ?? []).map((f) => ({
        id: f.id,
        message: f.message,
        category: f.category,
        email: f.email,
        createdAt: f.created_at,
      })),
    },
    childProfiles: totalProfiles ?? 0,
  };
}
