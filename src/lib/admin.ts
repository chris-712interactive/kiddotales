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
