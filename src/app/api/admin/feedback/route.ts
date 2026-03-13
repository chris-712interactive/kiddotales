import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("feedback")
      .select("id, user_id, email, message, category, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ feedback: data ?? [] });
  } catch (e) {
    console.error("GET /api/admin/feedback:", e);
    return NextResponse.json(
      { error: "Failed to load feedback" },
      { status: 500 }
    );
  }
}
