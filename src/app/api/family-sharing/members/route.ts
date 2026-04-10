import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { removeFamilyShareMember } from "@/lib/family-sharing";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { memberUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberUserId =
    typeof body.memberUserId === "string" ? body.memberUserId.trim() : "";
  if (!memberUserId) {
    return NextResponse.json({ error: "memberUserId is required." }, { status: 400 });
  }

  const ok = await removeFamilyShareMember(session.user.id as string, memberUserId);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not remove member." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
