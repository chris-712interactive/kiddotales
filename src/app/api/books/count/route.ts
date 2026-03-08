import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserBookCountByPeriod, getBookLimitForUser } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0, limit: 3, period: "total" });
  }

  try {
    const userId = session.user.id as string;
    const { limit, period } = await getBookLimitForUser(userId);
    const count = await getUserBookCountByPeriod(userId, period);
    return NextResponse.json({ count, limit, period });
  } catch {
    return NextResponse.json({ count: 0, limit: 3, period: "total" });
  }
}
