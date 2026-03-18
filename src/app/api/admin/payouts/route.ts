import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getCommissions, getPayoutSummaryByAffiliate } from "@/lib/affiliates";

/** Last day of month (YYYY-MM) as YYYY-MM-DD */
function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

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
    const month = searchParams.get("month"); // YYYY-MM
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    let dateRange: { startDate: string; endDate: string } | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      dateRange = { startDate: `${month}-01`, endDate: monthEnd(month) };
    } else if (startDate && endDate) {
      dateRange = { startDate, endDate };
    }

    if (dateRange) {
      const lineItems = await getCommissions({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 2000,
      });
      return NextResponse.json({
        lineItems,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
    }

    const summary = await getPayoutSummaryByAffiliate();
    return NextResponse.json({ payouts: summary });
  } catch (e) {
    console.error("GET /api/admin/payouts:", e);
    return NextResponse.json({ error: "Failed to load payouts" }, { status: 500 });
  }
}
