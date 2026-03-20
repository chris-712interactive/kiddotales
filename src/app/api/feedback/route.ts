import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

const MESSAGE_MAX_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ tickets: [] });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("feedback")
      .select("id, category, status, created_at, updated_at, unread_for_user, unread_for_admin")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] });
  } catch (e) {
    console.error("GET /api/feedback:", e);
    return NextResponse.json({ tickets: [] });
  }
}

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    const userEmail = session?.user?.email ?? null;

    if (userId) {
      const rateLimit = checkRateLimit(userId);
      if (!rateLimit.ok) {
        return NextResponse.json(
          {
            error: "Too many feedback submissions. Please try again later.",
            retryAfter: rateLimit.retryAfter,
          },
          {
            status: 429,
            headers: rateLimit.retryAfter
              ? { "Retry-After": String(rateLimit.retryAfter) }
              : undefined,
          }
        );
      }
    }

    let body: { message?: string; category?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }
    if (message.length > MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MESSAGE_MAX_LENGTH} characters or less.` },
        { status: 400 }
      );
    }

    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : null;
    const email = session?.user
      ? userEmail
      : (typeof body.email === "string" ? body.email.trim() || null : null);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Feedback is not configured." },
        { status: 500 }
      );
    }

    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: created, error: createError } = await supabase
      .from("feedback")
      .insert({
        user_id: userId ?? null,
        email,
        message,
        category,
        status: "new",
        unread_for_user: false,
        unread_for_admin: true,
        updated_at: now,
      })
      .select("id")
      .single();
    if (createError || !created?.id) throw createError ?? new Error("Failed to create feedback");

    const { error: messageError } = await supabase.from("feedback_messages").insert({
      feedback_id: created.id,
      sender_role: "user",
      sender_user_id: userId ?? null,
      sender_email: email,
      message,
      created_at: now,
    });
    if (messageError) throw messageError;

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("POST /api/feedback:", e);
    return NextResponse.json(
      { error: "Failed to submit feedback." },
      { status: 500 }
    );
  }
}
