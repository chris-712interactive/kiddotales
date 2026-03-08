import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getTierFromPriceId } from "@/lib/stripe";
import {
  ensureUser,
  getUserProfile,
  updateSubscriptionFromStripe,
} from "@/lib/db";

/** Create Stripe Checkout Session for subscription (server-side, secure). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error: "Stripe is not configured",
        hint: "Ensure STRIPE_SECRET_KEY is in .env (project root) and restart the dev server (Ctrl+C, then npm run dev).",
      },
      { status: 500 }
    );
  }

  let body: { priceId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { priceId } = body;
  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json(
      { error: "priceId is required" },
      { status: 400 }
    );
  }

  const tier = getTierFromPriceId(priceId);
  if (!tier || tier === "free") {
    return NextResponse.json(
      { error: "Invalid price ID" },
      { status: 400 }
    );
  }

  const userId = session.user.id as string;
  const userEmail = session.user.email;

  try {
    await ensureUser(userId, userEmail);
    const profile = await getUserProfile(userId);
    const stripeCustomerId = profile?.stripeCustomerId ?? undefined;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const successUrl = `${baseUrl}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing?canceled=true`;

    const sessionParams: {
      mode: "subscription";
      customer_email?: string;
      customer?: string;
      line_items: { price: string; quantity: number }[];
      success_url: string;
      cancel_url: string;
      metadata: { userId: string; tier: string };
      subscription_data?: { metadata: { userId: string; tier: string } };
      allow_promotion_codes?: boolean;
    } = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, tier },
      subscription_data: { metadata: { userId, tier } },
      allow_promotion_codes: true,
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else {
      sessionParams.customer_email = userEmail;
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[Stripe checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
