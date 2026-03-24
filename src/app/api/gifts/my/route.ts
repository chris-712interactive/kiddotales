import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, listPurchasedGiftMemberships } from "@/lib/db";

/** List gift memberships purchased by current user. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id as string;
    await ensureUser(userId, session.user.email ?? undefined);
    const gifts = await listPurchasedGiftMemberships(userId);
    return NextResponse.json({ gifts });
  } catch (err) {
    console.error("[Gifts my]", err);
    return NextResponse.json(
      { error: "Failed to load gifts" },
      { status: 500 }
    );
  }
}
