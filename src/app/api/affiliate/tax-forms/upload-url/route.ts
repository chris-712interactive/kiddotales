import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAffiliateByUserId } from "@/lib/affiliates";
import { createSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "affiliate-tax-forms";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const affiliate = await getAffiliateByUserId(userId);
  if (!affiliate) {
    return NextResponse.json({ error: "Not an affiliate" }, { status: 403 });
  }

  let body: { filename?: string; mimeType?: string; sizeBytes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filename = String(body.filename ?? "").trim() || "w9.pdf";
  const mimeType = String(body.mimeType ?? "application/pdf").trim();
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }

  const safeName = filename.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "w9.pdf";
  const objectName = `affiliate/${affiliate.id}/w9/${crypto.randomUUID()}.pdf`;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(objectName);
  if (error || !data) {
    console.error("createSignedUploadUrl error:", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    bucket: BUCKET,
    path: objectName,
    token: data.token,
    signedUrl: data.signedUrl,
    originalFilename: safeName,
    mimeType,
    maxBytes: MAX_BYTES,
  });
}

