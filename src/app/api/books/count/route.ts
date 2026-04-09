import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserBookCountByPeriod, getBookLimitForUser } from "@/lib/db";
import { resolveFamilyPlanContext } from "@/lib/family-sharing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0, limit: 3, period: "total" });
  }

  try {
    const userId = session.user.id as string;
    const plan = await resolveFamilyPlanContext(userId);
    const { limit, period } = await getBookLimitForUser(plan.billingUserId);
    const count = await getUserBookCountByPeriod(plan.billingUserId, period);
    return NextResponse.json({ count, limit, period });
  } catch {
    return NextResponse.json({ count: 0, limit: 3, period: "total" });
  }
}
