import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase";

const MESSAGE_MAX_LENGTH = 2000;
const VALID_STATUS = new Set(["new", "in_review", "resolved"]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email: session.user.email };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  try {
    const supabase = createSupabaseAdmin();
    const { data: ticket, error: ticketError } = await supabase
      .from("feedback")
      .select("id, user_id, email, message, category, status, unread_for_user, unread_for_admin, created_at, updated_at")
      .eq("id", id)
      .single();
    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabase
      .from("feedback_messages")
      .select("id, sender_role, sender_email, message, created_at")
      .eq("feedback_id", id)
      .order("created_at", { ascending: true });
    if (msgError) throw msgError;

    await supabase
      .from("feedback")
      .update({
        unread_for_admin: false,
        last_admin_read_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ticket, messages: messages ?? [] });
  } catch (e) {
    console.error("GET /api/admin/feedback/[id]:", e);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  let body: { message?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MESSAGE_MAX_LENGTH} characters or less.` },
      { status: 400 }
    );
  }
  if (status && !VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("feedback_messages").insert({
      feedback_id: id,
      sender_role: "admin",
      sender_email: admin.email,
      message,
      created_at: now,
    });
    if (insertError) throw insertError;

    const updatePayload: Record<string, string | boolean> = {
      updated_at: now,
      unread_for_user: true,
      unread_for_admin: false,
    };
    if (status) updatePayload.status = status;

    const { error: updateError } = await supabase
      .from("feedback")
      .update(updatePayload)
      .eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/admin/feedback/[id]:", e);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
