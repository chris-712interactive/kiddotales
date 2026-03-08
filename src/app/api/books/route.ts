import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBooksByUserId, getUserProfile } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }

  try {
    const userId = session.user.id as string;
    const profile = await getUserProfile(userId);
    const tier = profile?.subscriptionTier ?? "free";
    const books = await getBooksByUserId(userId, tier);
    return NextResponse.json(books);
  } catch {
    return NextResponse.json([]);
  }
}
