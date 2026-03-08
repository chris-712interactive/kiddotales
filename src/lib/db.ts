import { createSupabaseAdmin } from "./supabase";
import type { BookData } from "@/types";

const BOOK_LIMIT = parseInt(process.env.BOOK_LIMIT_PER_USER || "5", 10);

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  subscriptionTier: string;
  theme: "light" | "dark";
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
    .select("id, email, display_name, phone, subscription_tier, theme, created_at, updated_at")
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
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? null,
  };
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

/** Get current book count for user. */
export async function getUserBookCount(userId: string): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_book_counts")
    .select("book_count")
    .eq("user_id", userId)
    .single();

  if (error || !data) return 0;
  return data.book_count ?? 0;
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

/** Get books for user (for "My Books" / history). */
export async function getBooksByUserId(userId: string): Promise<BookData[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

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

export { BOOK_LIMIT };
