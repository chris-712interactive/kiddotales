import { createSupabaseAdmin } from "./supabase";

const BUCKET = "book-images";

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
