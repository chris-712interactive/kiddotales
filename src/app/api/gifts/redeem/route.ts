import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, redeemGiftMembershipCode } from "@/lib/db";

/** Redeem a purchased gift membership code. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Gift code is required" }, { status: 400 });
  }

  try {
    const userId = session.user.id as string;
    await ensureUser(userId, session.user.email ?? undefined);
    const result = await redeemGiftMembershipCode(userId, code);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to redeem gift code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      gift: result.gift,
      message:
        result.gift?.startsAt && new Date(result.gift.startsAt) > new Date()
          ? "Gift redeemed. It will activate when your current billing period ends."
          : "Gift redeemed successfully.",
    });
  } catch (err) {
    console.error("[Gift redeem]", err);
    return NextResponse.json(
      { error: "Failed to redeem gift code" },
      { status: 500 }
    );
  }
}
