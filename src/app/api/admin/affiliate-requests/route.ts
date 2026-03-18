import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAffiliateRequests } from "@/lib/affiliates";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;

  try {
    const requests = await listAffiliateRequests(
      status ? { status: status as "pending" | "approved" | "rejected" } : undefined
    );
    return NextResponse.json({ requests });
  } catch (e) {
    console.error("GET /api/admin/affiliate-requests:", e);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
