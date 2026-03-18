import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { rejectAffiliateRequest } from "@/lib/affiliates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing request ID" }, { status: 400 });

  const ok = await rejectAffiliateRequest(id);
  if (!ok) return NextResponse.json({ error: "Request not found or already processed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
