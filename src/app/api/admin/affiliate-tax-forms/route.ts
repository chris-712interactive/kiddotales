import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAffiliateTaxFormsForAdmin } from "@/lib/affiliate-tax-forms";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? undefined) as
      | "submitted"
      | "verified"
      | "rejected"
      | undefined;
    const month = searchParams.get("month") ?? undefined; // YYYY-MM
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 200;

    const forms = await listAffiliateTaxFormsForAdmin({
      status,
      month,
      limit: Number.isFinite(limit) ? limit : 200,
    });
    return NextResponse.json({ forms });
  } catch (e) {
    console.error("GET /api/admin/affiliate-tax-forms:", e);
    return NextResponse.json({ error: "Failed to load tax forms" }, { status: 500 });
  }
}

