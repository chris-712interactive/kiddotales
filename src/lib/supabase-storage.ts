import { createSupabaseAdmin } from "./supabase";

const BUCKET = "book-images";

function getBookStoragePaths(bookId: string): string[] {
  const paths: string[] = [`books/${bookId}/cover.png`];
  for (let i = 0; i < 8; i++) {
    paths.push(`books/${bookId}/page-${i}.png`);
    paths.push(`books/${bookId}/audio/page-${i}.mp3`);
  }
  return paths;
}

/** Fetches image from URL and uploads to Supabase Storage. Returns public URL. Bucket must exist. */
export async function uploadImageToStorage(
  imageUrl: string,
  path: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "KiddoTales/1.0" },
      mode: "cors",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    const supabase = createSupabaseAdmin();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: blob.type || "image/png",
      upsert: true,
    });
    if (error) {
      console.error("[KiddoTales] Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error("[KiddoTales] uploadImageToStorage error:", err);
    return null;
  }
}

/** Upload audio buffer to Supabase Storage. Returns public URL. */
export async function uploadAudioToStorage(
  buffer: Buffer,
  path: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (error) {
      console.error("[KiddoTales] Audio storage upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error("[KiddoTales] uploadAudioToStorage error:", err);
    return null;
  }
}

/** Delete all storage files for a book. */
export async function deleteBookStorage(bookId: string): Promise<void> {
  const paths = getBookStoragePaths(bookId);
  const supabase = createSupabaseAdmin();
  await supabase.storage.from(BUCKET).remove(paths);
}

/** Delete storage for all books belonging to a user. */
export async function deleteUserBookStorage(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: books } = await supabase.from("books").select("id").eq("user_id", userId);
  if (!books?.length) return;
  for (const book of books) {
    await deleteBookStorage(book.id);
  }
}
