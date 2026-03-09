import { createSupabaseAdmin } from "./supabase";
import { getBookLimitForTier, type BookLimitPeriod } from "./stripe";
import type { BookData } from "@/types";

/** @deprecated Use getBookLimitForUser with tier instead */
const BOOK_LIMIT = parseInt(process.env.BOOK_LIMIT_PER_USER || "3", 10);

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  subscriptionTier: string;
  theme: "light" | "dark";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripePriceId?: string | null;
  parentConsentAt?: string | null;
  parentConsentVersion?: string | null;
  createdAt: string;
  updatedAt: string | null;
};

/** Ensure user exists in users table. */
export async function ensureUser(userId: string, email?: string | null): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("users").upsert(
    { id: userId, email: email || null, created_at: new Date().toISOString() },
    { onConflict: "id" }
  );
}

/** Get user profile by ID. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, display_name, phone, subscription_tier, theme, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, parent_consent_at, parent_consent_version, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  const theme = data.theme === "dark" ? "dark" : "light";
  return {
    id: data.id,
    email: data.email ?? null,
    displayName: data.display_name ?? null,
    phone: data.phone ?? null,
    subscriptionTier: data.subscription_tier ?? "free",
    theme,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
    stripeSubscriptionStatus: data.stripe_subscription_status ?? null,
    stripePriceId: data.stripe_price_id ?? null,
    parentConsentAt: data.parent_consent_at ?? null,
    parentConsentVersion: data.parent_consent_version ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? null,
  };
}

/** Get book creation limit and period for user based on subscription tier. */
export async function getBookLimitForUser(userId: string): Promise<{
  limit: number;
  period: BookLimitPeriod;
}> {
  const profile = await getUserProfile(userId);
  const tier = profile?.subscriptionTier ?? "free";
  return getBookLimitForTier(tier);
}

/** Get book count for user by period: total (all time) or monthly (current UTC month). */
export async function getUserBookCountByPeriod(
  userId: string,
  period: BookLimitPeriod
): Promise<number> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  let query = supabase
    .from("books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (period === "monthly") {
    query = query
      .gte("created_at", startOfMonth.toISOString())
      .lt("created_at", startOfNextMonth.toISOString());
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/** Max number of saved books to show in history (Spark: 10, Magic/Legend: unlimited). */
export function getBookHistoryLimit(tier: string): number {
  if (tier === "magic" || tier === "legend") return 500; // effectively unlimited
  if (tier === "spark") return 10;
  return 3; // free
}

/** Update user subscription from Stripe webhook data. */
export async function updateSubscriptionFromStripe(
  userId: string,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionStatus?: string | null;
    stripePriceId?: string | null;
    subscriptionTier?: string;
  }
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.stripeCustomerId !== undefined) payload.stripe_customer_id = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) payload.stripe_subscription_id = data.stripeSubscriptionId;
  if (data.stripeSubscriptionStatus !== undefined) payload.stripe_subscription_status = data.stripeSubscriptionStatus;
  if (data.stripePriceId !== undefined) payload.stripe_price_id = data.stripePriceId;
  if (data.subscriptionTier !== undefined) payload.subscription_tier = data.subscriptionTier;
  await supabase.from("users").update(payload).eq("id", userId);
}

/** Update user profile (contact info, theme, etc.). */
export async function updateUserProfile(
  userId: string,
  updates: {
    displayName?: string | null;
    phone?: string | null;
    theme?: "light" | "dark";
  }
): Promise<UserProfile | null> {
  const supabase = createSupabaseAdmin();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.theme !== undefined) payload.theme = updates.theme;

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select("id, email, display_name, phone, subscription_tier, theme, created_at, updated_at")
    .single();

  if (error || !data) return null;

  const theme = data.theme === "dark" ? "dark" : "light";
  return {
    id: data.id,
    email: data.email ?? null,
    displayName: data.display_name ?? null,
    phone: data.phone ?? null,
    subscriptionTier: data.subscription_tier ?? "free",
    theme,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? null,
  };
}

/** Get current book count for user (total, for backward compatibility). */
export async function getUserBookCount(userId: string): Promise<number> {
  return getUserBookCountByPeriod(userId, "total");
}

/** Increment book count for user. */
export async function incrementUserBookCount(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const count = await getUserBookCount(userId);
  await supabase.from("user_book_counts").upsert(
    {
      user_id: userId,
      book_count: count + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

/** Save book to Supabase. Uses bookId if provided. */
export async function saveBookToSupabase(
  userId: string,
  book: BookData,
  bookId?: string
): Promise<string> {
  const supabase = createSupabaseAdmin();
  const row = {
    id: bookId ?? crypto.randomUUID(),
    user_id: userId,
    title: book.title,
    created_at: book.createdAt,
    cover_image_url: book.coverImageUrl || null,
    cover_image_data: book.coverImageData || null,
    pages: book.pages,
  };
  const { data, error } = await supabase
    .from("books")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save book: ${error.message}`);
  return data.id;
}

/** Update last_opened_at for a book when user views it. */
export async function updateBookLastOpened(bookId: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase
    .from("books")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("user_id", userId);
}

/** Update last_login_at for user (call on sign-in). */
export async function updateUserLastLogin(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/** Get book by ID. Optionally restrict to userId for auth. */
export async function getBookById(
  bookId: string,
  userId?: string
): Promise<BookData | null> {
  const supabase = createSupabaseAdmin();
  let query = supabase.from("books").select("*").eq("id", bookId);
  if (userId) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    pages: data.pages as BookData["pages"],
    createdAt: data.created_at,
    coverImageUrl: data.cover_image_url || undefined,
    coverImageData: data.cover_image_data || undefined,
  };
}

/** Get books for user (for "My Books" / history). Uses tier for limit. */
export async function getBooksByUserId(userId: string, tier?: string): Promise<BookData[]> {
  const supabase = createSupabaseAdmin();
  const limit = tier ? getBookHistoryLimit(tier) : 10;
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    pages: row.pages,
    createdAt: row.created_at,
    coverImageUrl: row.cover_image_url || undefined,
    coverImageData: row.cover_image_data || undefined,
  }));
}

/** Record verifiable parental consent (COPPA). */
export async function recordParentConsent(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("users").update({
    parent_consent_at: new Date().toISOString(),
    parent_consent_version: "1.0",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

/** Revoke parental consent. Blocks future book creation until re-consent. */
export async function revokeParentConsent(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("users").update({
    parent_consent_at: null,
    parent_consent_version: null,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

/** Delete a single book by ID. Caller must verify userId owns the book. */
export async function deleteBook(bookId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", userId);
  if (error) return false;
  const count = await getUserBookCount(userId);
  await supabase.from("user_book_counts").upsert(
    { user_id: userId, book_count: Math.max(0, count - 1), updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return true;
}

/** Get all books for user (no limit). For manage/delete UI. Includes lastOpenedAt for retention warnings. */
export async function getAllBooksByUserId(userId: string): Promise<(BookData & { lastOpenedAt?: string | null })[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    pages: row.pages,
    createdAt: row.created_at,
    coverImageUrl: row.cover_image_url || undefined,
    coverImageData: row.cover_image_data || undefined,
    lastOpenedAt: row.last_opened_at ?? null,
  }));
}

/** Run retention deletion: remove books per free-tier policy. Returns count deleted. */
export async function runRetentionDeletion(): Promise<{ deletedBooks: number }> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const { data: freeUsers } = await supabase
    .from("users")
    .select("id, last_login_at")
    .eq("subscription_tier", "free");

  const freeUserIds = (freeUsers ?? []).map((u) => u.id);
  if (freeUserIds.length === 0) return { deletedBooks: 0 };

  const { data: books } = await supabase
    .from("books")
    .select("id, user_id, created_at, last_opened_at")
    .in("user_id", freeUserIds);

  const userMap = new Map((freeUsers ?? []).map((u) => [u.id, u]));
  let deleted = 0;

  for (const book of books ?? []) {
    const user = userMap.get(book.user_id);
    if (!user) continue;

    const lastOpened = book.last_opened_at ? new Date(book.last_opened_at) : new Date(book.created_at);
    const createdAt = new Date(book.created_at);
    const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;

    const shouldDeleteByRule1 =
      (!lastLogin || lastLogin < thirtyDaysAgo) && createdAt < threeMonthsAgo;
    const shouldDeleteByRule2 = lastOpened < ninetyDaysAgo;

    if (shouldDeleteByRule1 || shouldDeleteByRule2) {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { deleteBookStorage } = await import("./supabase-storage");
        await deleteBookStorage(book.id);
      }
      const ok = await deleteBook(book.id, book.user_id);
      if (ok) deleted++;
    }
  }

  return { deletedBooks: deleted };
}

/** Delete all books and child data for a user. Resets book count. */
export async function deleteAllUserChildData(userId: string): Promise<{ deletedBooks: number }> {
  const supabase = createSupabaseAdmin();
  const { data: books } = await supabase
    .from("books")
    .select("id")
    .eq("user_id", userId);
  const count = books?.length ?? 0;

  await supabase.from("books").delete().eq("user_id", userId);
  await supabase.from("user_book_counts").upsert(
    { user_id: userId, book_count: 0, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return { deletedBooks: count };
}

export { BOOK_LIMIT };
