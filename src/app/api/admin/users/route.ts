import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = (page - 1) * limit;

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, display_name, subscription_tier, created_at, stripe_subscription_status")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      console.error("Admin users list error:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const userIds = (users ?? []).map((u) => u.id);
    const bookCounts: Record<string, number> = {};
    for (const id of userIds) {
      bookCounts[id] = 0;
    }
    if (userIds.length > 0) {
      const { data: books } = await supabase
        .from("books")
        .select("user_id")
        .in("user_id", userIds);
      for (const b of books ?? []) {
        if (b.user_id && bookCounts[b.user_id] !== undefined) {
          bookCounts[b.user_id]++;
        }
      }
    }

    const { count: totalCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const list = (users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      displayName: u.display_name ?? null,
      subscriptionTier: u.subscription_tier ?? "free",
      stripeSubscriptionStatus: u.stripe_subscription_status ?? null,
      createdAt: u.created_at,
      bookCount: bookCounts[u.id] ?? 0,
    }));

    return NextResponse.json({
      users: list,
      total: totalCount ?? 0,
      page,
      limit,
    });
  } catch (e) {
    console.error("GET /api/admin/users:", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
