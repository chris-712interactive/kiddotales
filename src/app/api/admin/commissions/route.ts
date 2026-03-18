import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getCommissions } from "@/lib/affiliates";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get("affiliateId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 200;

    const commissions = await getCommissions({
      affiliateId: affiliateId || undefined,
      status: status || undefined,
      limit,
    });
    return NextResponse.json({ commissions });
  } catch (e) {
    console.error("GET /api/admin/commissions:", e);
    return NextResponse.json({ error: "Failed to load commissions" }, { status: 500 });
  }
}
