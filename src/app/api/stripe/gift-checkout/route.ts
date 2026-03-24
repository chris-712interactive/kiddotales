import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/lib/db";
import { getStripe, getStripeGiftPriceIds } from "@/lib/stripe";

type GiftTier = "spark" | "magic" | "legend";
type GiftPeriod = "monthly" | "yearly";

/** Create Stripe Checkout Session for one-time gift membership purchase. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  let body: {
    tier?: GiftTier;
    period?: GiftPeriod;
    recipientEmail?: string;
    sendRecipientEmail?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = body.tier;
  const period = body.period;
  const sendRecipientEmail = body.sendRecipientEmail === true;
  const recipientEmail = body.recipientEmail?.trim().toLowerCase();
  if (sendRecipientEmail && !recipientEmail) {
    return NextResponse.json(
      { error: "Recipient email is required when recipient email option is enabled" },
      { status: 400 }
    );
  }

  if (!tier || !["spark", "magic", "legend"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!period || !["monthly", "yearly"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const giftPrices = getStripeGiftPriceIds();
  const priceId = giftPrices[tier][period];
  if (!priceId) {
    return NextResponse.json(
      { error: "Gift checkout is not configured for this plan yet" },
      { status: 400 }
    );
  }

  try {
    const userId = session.user.id as string;
    await ensureUser(userId, session.user.email ?? undefined);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const successUrl = `${baseUrl}/settings?gift=purchased&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing?gift_canceled=true`;
    const durationMonths = period === "yearly" ? 12 : 1;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        kind: "gift_membership",
        purchaserUserId: userId,
        purchaserEmail: session.user.email,
        recipientEmail: sendRecipientEmail ? recipientEmail ?? "" : "",
        tier,
        period,
        durationMonths: String(durationMonths),
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[Stripe gift checkout]", err);
    return NextResponse.json(
      { error: "Failed to create gift checkout session" },
      { status: 500 }
    );
  }
}
