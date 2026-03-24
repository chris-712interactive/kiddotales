import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getPurchasedGiftMembershipById,
} from "@/lib/db";
import { sendGiftMembershipEmails } from "@/lib/mailgun";

/** Resend gift code emails to purchaser and recipient (if available). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { giftId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const giftId = body.giftId?.trim();
  if (!giftId) {
    return NextResponse.json({ error: "giftId is required" }, { status: 400 });
  }

  try {
    const userId = session.user.id as string;
    await ensureUser(userId, session.user.email ?? undefined);
    const gift = await getPurchasedGiftMembershipById(giftId, userId);
    if (!gift) {
      return NextResponse.json({ error: "Gift not found" }, { status: 404 });
    }

    await sendGiftMembershipEmails({
      purchaserEmail: gift.purchaserEmail,
      recipientEmail: gift.recipientEmail,
      giftCode: gift.code,
      tier: gift.tier,
      durationMonths: gift.durationMonths,
    });

    return NextResponse.json({
      success: true,
      message: gift.recipientEmail
        ? "Gift email resent to purchaser and recipient."
        : "Gift email resent to purchaser. No recipient email was provided.",
    });
  } catch (err) {
    console.error("[Gifts resend]", err);
    return NextResponse.json(
      { error: "Failed to resend gift email" },
      { status: 500 }
    );
  }
}
