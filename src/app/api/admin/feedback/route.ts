import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase";

const VALID_STATUS = new Set(["new", "in_review", "resolved"]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();

  try {
    // Try full select (requires migration 027); fall back to base columns if new columns don't exist.
    const { data: fullData, error: fullError } = await supabase
      .from("feedback")
      .select(
        "id, user_id, email, message, category, status, unread_for_user, unread_for_admin, admin_response, responded_at, responded_by_email, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (!fullError) {
      return NextResponse.json({ feedback: fullData ?? [] });
    }

    // Fallback: base columns only (works without migration 027)
    const { data: baseData, error: baseError } = await supabase
      .from("feedback")
      .select("id, user_id, email, message, category, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (baseError) throw baseError;

    const feedback = (baseData ?? []).map(
      (row: { id: string; user_id: string | null; email: string | null; message: string; category: string | null; created_at: string }) => ({
        ...row,
        status: "new",
        unread_for_user: false,
        unread_for_admin: true,
        admin_response: null,
        responded_at: null,
        responded_by_email: null,
        updated_at: row.created_at,
      })
    );

    return NextResponse.json({ feedback });
  } catch (e) {
    console.error("GET /api/admin/feedback:", e);
    return NextResponse.json(
      { error: "Failed to load feedback" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    id?: string;
    status?: string;
    adminResponse?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const adminResponseRaw =
    typeof body.adminResponse === "string"
      ? body.adminResponse.trim()
      : body.adminResponse === null
        ? null
        : undefined;

  if (!id) {
    return NextResponse.json({ error: "Feedback id is required" }, { status: 400 });
  }
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const responseProvided = typeof adminResponseRaw === "string" && adminResponseRaw.length > 0;
  const updates: {
    status: string;
    updated_at: string;
    admin_response?: string | null;
    responded_at?: string | null;
    responded_by_email?: string | null;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminResponseRaw !== undefined) {
    updates.admin_response = adminResponseRaw;
    updates.responded_at = responseProvided ? new Date().toISOString() : null;
    updates.responded_by_email = responseProvided ? session.user.email : null;
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("feedback").update(updates).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/feedback:", e);
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500 }
    );
  }
}
