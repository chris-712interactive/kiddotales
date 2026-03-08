import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserBookCount, BOOK_LIMIT } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0, limit: BOOK_LIMIT });
  }

  try {
    const count = await getUserBookCount(session.user.id as string);
    return NextResponse.json({ count, limit: BOOK_LIMIT });
  } catch {
    return NextResponse.json({ count: 0, limit: BOOK_LIMIT });
  }
}
