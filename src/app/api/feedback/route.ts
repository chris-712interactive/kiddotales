import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { insertFeedback } from "@/lib/db";

const MESSAGE_MAX_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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

    await insertFeedback({
      userId: userId ?? null,
      email,
      message,
      category,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/feedback:", e);
    return NextResponse.json(
      { error: "Failed to submit feedback." },
      { status: 500 }
    );
  }
}
