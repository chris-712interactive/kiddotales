import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelFamilyShareInvite } from "@/lib/family-sharing";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invite id required" }, { status: 400 });
  }

  const ok = await cancelFamilyShareInvite(session.user.id as string, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not cancel invite." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
