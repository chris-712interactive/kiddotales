import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

const MESSAGE_MAX_LENGTH = 2000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const supabase = createSupabaseAdmin();
    const { data: ticket, error: ticketError } = await supabase
      .from("feedback")
      .select("id, user_id, email, category, status, created_at, updated_at, unread_for_user")
      .eq("id", id)
      .eq("user_id", userId)
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
        unread_for_user: false,
        last_user_read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    return NextResponse.json({ ticket, messages: messages ?? [] });
  } catch (e) {
    console.error("GET /api/feedback/[id]:", e);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MESSAGE_MAX_LENGTH} characters or less.` },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: ticket, error: ticketError } = await supabase
      .from("feedback")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("feedback_messages").insert({
      feedback_id: id,
      sender_role: "user",
      sender_user_id: userId,
      sender_email: userEmail,
      message,
      created_at: now,
    });
    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from("feedback")
      .update({
        updated_at: now,
        unread_for_user: false,
        unread_for_admin: true,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/feedback/[id]:", e);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
