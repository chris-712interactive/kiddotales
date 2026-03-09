import { NextRequest, NextResponse } from "next/server";
import { runRetentionDeletion } from "@/lib/db";

/**
 * Retention cron job. Call via Vercel Cron or external scheduler.
 * Protect with CRON_SECRET: pass as ?secret=xxx or Authorization: Bearer <token>.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const urlSecret = request.nextUrl.searchParams.get("secret");

  const provided = authHeader === `Bearer ${cronSecret}` || urlSecret === cronSecret;
  if (cronSecret && !provided) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Supabase not configured", deletedBooks: 0 },
        { status: 400 }
      );
    }

    const { deletedBooks } = await runRetentionDeletion();
    return NextResponse.json({ success: true, deletedBooks });
  } catch (e) {
    console.error("[Retention cron]", e);
    return NextResponse.json(
      { error: "Retention job failed", deletedBooks: 0 },
      { status: 500 }
    );
  }
}
