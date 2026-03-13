import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail, getAdminStats } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (e) {
    console.error("GET /api/admin/stats:", e);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
