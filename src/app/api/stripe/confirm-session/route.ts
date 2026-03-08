import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, getTierFromPriceId } from "@/lib/stripe";
import { updateSubscriptionFromStripe } from "@/lib/db";

/**
 * Confirm a completed checkout session and sync subscription to our DB.
 * Called when user returns from Stripe Checkout (fallback when webhook misses).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  let body: { sessionId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  const userId = session.user.id as string;

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkoutSession.mode !== "subscription" || !checkoutSession.subscription) {
      return NextResponse.json(
        { error: "Not a subscription session" },
        { status: 400 }
      );
    }

    const metadataUserId = checkoutSession.metadata?.userId;
    if (metadataUserId && metadataUserId !== userId) {
      return NextResponse.json(
        { error: "Session does not belong to this user" },
        { status: 403 }
      );
    }

    const sub =
      typeof checkoutSession.subscription === "object"
        ? checkoutSession.subscription
        : await stripe.subscriptions.retrieve(
            checkoutSession.subscription as string
          );

    const priceId =
      typeof sub.items.data[0]?.price?.id === "string"
        ? sub.items.data[0].price.id
        : sub.items.data[0]?.price?.id ?? null;

    const tier = priceId ? getTierFromPriceId(priceId) : null;

    await updateSubscriptionFromStripe(userId, {
      stripeCustomerId: checkoutSession.customer as string,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
      stripePriceId: priceId,
      subscriptionTier: tier ?? "spark",
    });

    return NextResponse.json({ success: true, tier: tier ?? "spark" });
  } catch (err) {
    console.error("[Stripe confirm-session]", err);
    return NextResponse.json(
      { error: "Failed to confirm session" },
      { status: 500 }
    );
  }
}
