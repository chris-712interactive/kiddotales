import { createSupabaseAdmin } from "./supabase";
import { getBookLimitForTier, getStripe, type BookLimitPeriod } from "./stripe";
import type { BookData, CreationMetadata, ChildProfile } from "@/types";

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
  tierUpgradeAt?: string | null;
  tierBeforeUpgrade?: string | null;
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
    .select("id, email, display_name, phone, subscription_tier, theme, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, parent_consent_at, parent_consent_version, tier_upgrade_at, tier_before_upgrade, created_at, updated_at")
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
    tierUpgradeAt: data.tier_upgrade_at ?? null,
    tierBeforeUpgrade: data.tier_before_upgrade ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? null,
  };
}

/** Get book creation limit and period for user based on subscription tier.
 * When user upgraded mid-cycle, prorates the book limit increase (ceil). */
export async function getBookLimitForUser(userId: string): Promise<{
  limit: number;
  period: BookLimitPeriod;
}> {
  const profile = await getUserProfile(userId);
  const tier = profile?.subscriptionTier ?? "free";
  const base = getBookLimitForTier(tier);

  // Prorate book limit when user upgraded mid-cycle
  const upgradeAt = profile?.tierUpgradeAt;
  const beforeTier = profile?.tierBeforeUpgrade;
  if (
    upgradeAt &&
    beforeTier &&
    profile?.stripeSubscriptionId &&
    base.period === "monthly"
  ) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          profile.stripeSubscriptionId,
          { expand: ["items.data"] }
        );
        const item = sub.items?.data?.[0];
        const periodStart = item?.current_period_start;
        const periodEnd = item?.current_period_end;
        if (
          typeof periodStart === "number" &&
          typeof periodEnd === "number"
        ) {
          const upgradeTs = new Date(upgradeAt).getTime() / 1000;
          if (upgradeTs >= periodStart && upgradeTs < periodEnd) {
            const oldLimit = getBookLimitForTier(beforeTier).limit;
            const newLimit = base.limit;
            const diff = newLimit - oldLimit;
            if (diff > 0) {
              const daysLeft = periodEnd - upgradeTs;
              const daysTotal = periodEnd - periodStart;
              const proratedIncrease = Math.ceil(
                (daysLeft / daysTotal) * diff
              );
              return {
                limit: oldLimit + proratedIncrease,
                period: base.period,
              };
            }
          }
        }
      } catch {
        // Fall back to full tier limit on Stripe errors
      }
    }
  }

  return base;
}

/** Get book usage (creations) for user by period. Deletions do not reduce this.
 * For "monthly" with a subscription, uses Stripe billing period; otherwise calendar month. */
export async function getUserBookCountByPeriod(
  userId: string,
  period: BookLimitPeriod
): Promise<number> {
  const supabase = createSupabaseAdmin();
  let start: Date;
  let end: Date;

  if (period === "monthly") {
    const now = new Date();
    const calendarStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const calendarEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const profile = await getUserProfile(userId);
    if (profile?.stripeSubscriptionId) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(
            profile.stripeSubscriptionId,
            { expand: ["items.data"] }
          );
          const periodStart = sub.items?.data?.[0]?.current_period_start;
          const periodEnd = sub.items?.data?.[0]?.current_period_end;
          if (
            typeof periodStart === "number" &&
            typeof periodEnd === "number"
          ) {
            start = new Date(periodStart * 1000);
            end = new Date(periodEnd * 1000);
          } else {
            start = calendarStart;
            end = calendarEnd;
          }
        } catch {
          start = calendarStart;
          end = calendarEnd;
        }
      } else {
        start = calendarStart;
        end = calendarEnd;
      }
    } else {
      start = calendarStart;
      end = calendarEnd;
    }
  } else {
    start = new Date(0);
    end = new Date(8640000000000000); // far future for "total"
  }

  let query = supabase
    .from("user_book_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (period === "monthly") {
    query = query
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/** Get voice usage count for user within period. Uses subscription billing period for paid tiers. */
export async function getUserVoiceCountByPeriod(
  userId: string,
  period: BookLimitPeriod
): Promise<number> {
  const supabase = createSupabaseAdmin();
  let start: Date;
  let end: Date;

  if (period === "monthly") {
    const now = new Date();
    const calendarStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const calendarEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const profile = await getUserProfile(userId);
    if (profile?.stripeSubscriptionId) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(
            profile.stripeSubscriptionId,
            { expand: ["items.data"] }
          );
          const periodStart = sub.items?.data?.[0]?.current_period_start;
          const periodEnd = sub.items?.data?.[0]?.current_period_end;
          if (
            typeof periodStart === "number" &&
            typeof periodEnd === "number"
          ) {
            start = new Date(periodStart * 1000);
            end = new Date(periodEnd * 1000);
          } else {
            start = calendarStart;
            end = calendarEnd;
          }
        } catch {
          start = calendarStart;
          end = calendarEnd;
        }
      } else {
        start = calendarStart;
        end = calendarEnd;
      }
    } else {
      start = calendarStart;
      end = calendarEnd;
    }
  } else {
    start = new Date(0);
    end = new Date(8640000000000000);
  }

  const { count, error } = await supabase
    .from("user_voice_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) return 0;
  return count ?? 0;
}

/** Check if a book has already used a voice slot (has any voice usage event). */
export async function hasBookUsedVoiceSlot(bookId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_voice_usage_events")
    .select("id")
    .eq("book_id", bookId)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/** Record a voice usage event when a book first gets AI voice. */
export async function insertVoiceUsageEvent(
  userId: string,
  bookId: string
): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("user_voice_usage_events").insert({
    user_id: userId,
    book_id: bookId,
    created_at: new Date().toISOString(),
  });
}

/** Record a book creation usage event (transaction log). */
export async function insertBookUsageEvent(
  userId: string,
  bookId?: string
): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("user_book_usage_events").insert({
    user_id: userId,
    book_id: bookId ?? null,
    created_at: new Date().toISOString(),
  });
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
    tierUpgradeAt?: string | null;
    tierBeforeUpgrade?: string | null;
  }
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.stripeCustomerId !== undefined) payload.stripe_customer_id = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) payload.stripe_subscription_id = data.stripeSubscriptionId;
  if (data.stripeSubscriptionStatus !== undefined) payload.stripe_subscription_status = data.stripeSubscriptionStatus;
  if (data.stripePriceId !== undefined) payload.stripe_price_id = data.stripePriceId;
  if (data.subscriptionTier !== undefined) payload.subscription_tier = data.subscriptionTier;
  if (data.tierUpgradeAt !== undefined) payload.tier_upgrade_at = data.tierUpgradeAt;
  if (data.tierBeforeUpgrade !== undefined) payload.tier_before_upgrade = data.tierBeforeUpgrade;
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
  bookId?: string,
  creationMetadata?: CreationMetadata | null
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
    creation_metadata: creationMetadata ?? null,
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

/** Update book pages with audio URLs. Merges audioUrl and audioVoice into specified pages. */
export async function updateBookPagesWithAudio(
  bookId: string,
  userId: string,
  updates: { pageIndex: number; audioUrl: string; audioVoice: string }[]
): Promise<boolean> {
  const book = await getBookById(bookId, userId);
  if (!book?.pages?.length) return false;

  const pages = [...book.pages];
  for (const { pageIndex, audioUrl, audioVoice } of updates) {
    if (pageIndex >= 0 && pageIndex < pages.length) {
      pages[pageIndex] = {
        ...pages[pageIndex],
        audioUrl,
        audioVoice,
      };
    }
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .update({ pages, updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
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
    creationMetadata: (data.creation_metadata as CreationMetadata) || undefined,
  };
}

/** Update book pages in place (for no-cost name correction). */
export async function updateBookPages(
  bookId: string,
  userId: string,
  pages: BookData["pages"]
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .update({ pages, updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
}

/** Update title, pages, and creation_metadata for name-only correction. */
export async function updateBookForNameCorrection(
  bookId: string,
  userId: string,
  data: {
    title: string;
    pages: BookData["pages"];
    creationMetadata: CreationMetadata;
  }
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .update({
      title: data.title,
      pages: data.pages,
      creation_metadata: data.creationMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
}

/** Update book creation_metadata (after correction). */
export async function updateBookCreationMetadata(
  bookId: string,
  userId: string,
  metadata: CreationMetadata
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .update({
      creation_metadata: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
}

/** Replace book content (for regeneration correction). Keeps id and created_at. */
export async function replaceBook(
  bookId: string,
  userId: string,
  book: Pick<BookData, "title" | "pages" | "coverImageUrl">,
  creationMetadata: CreationMetadata
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .update({
      title: book.title,
      pages: book.pages,
      cover_image_url: book.coverImageUrl || null,
      creation_metadata: creationMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
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

/** Delete a single book by ID. Caller must verify userId owns the book. Does not affect usage count. */
export async function deleteBook(bookId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", userId);
  return !error;
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

/** Get child profiles for user. */
export async function getChildProfiles(userId: string): Promise<ChildProfile[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    age: row.age ?? 5,
    pronouns: row.pronouns ?? "they/them",
    interests: (row.interests as string[]) ?? [],
    appearance: (row.appearance as ChildProfile["appearance"]) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }));
}

/** Create child profile. */
export async function createChildProfile(
  userId: string,
  profile: Omit<ChildProfile, "id" | "createdAt" | "updatedAt">
): Promise<ChildProfile | null> {
  const supabase = createSupabaseAdmin();
  const row = {
    user_id: userId,
    name: profile.name,
    age: profile.age,
    pronouns: profile.pronouns,
    interests: profile.interests,
    appearance: profile.appearance ?? {},
  };
  const { data, error } = await supabase
    .from("child_profiles")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    age: data.age ?? 5,
    pronouns: data.pronouns ?? "they/them",
    interests: (data.interests as string[]) ?? [],
    appearance: (data.appearance as ChildProfile["appearance"]) ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? undefined,
  };
}

/** Update child profile. */
export async function updateChildProfile(
  profileId: string,
  userId: string,
  updates: Partial<Omit<ChildProfile, "id" | "createdAt" | "updatedAt">>
): Promise<ChildProfile | null> {
  const supabase = createSupabaseAdmin();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.age !== undefined) payload.age = updates.age;
  if (updates.pronouns !== undefined) payload.pronouns = updates.pronouns;
  if (updates.interests !== undefined) payload.interests = updates.interests;
  if (updates.appearance !== undefined) payload.appearance = updates.appearance;

  const { data, error } = await supabase
    .from("child_profiles")
    .update(payload)
    .eq("id", profileId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    age: data.age ?? 5,
    pronouns: data.pronouns ?? "they/them",
    interests: (data.interests as string[]) ?? [],
    appearance: (data.appearance as ChildProfile["appearance"]) ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? undefined,
  };
}

/** Delete child profile. */
export async function deleteChildProfile(
  profileId: string,
  userId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("child_profiles")
    .delete()
    .eq("id", profileId)
    .eq("user_id", userId);
  return !error;
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
  await supabase.from("child_profiles").delete().eq("user_id", userId);
  await supabase.from("user_book_counts").upsert(
    { user_id: userId, book_count: 0, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return { deletedBooks: count };
}

export { BOOK_LIMIT };
