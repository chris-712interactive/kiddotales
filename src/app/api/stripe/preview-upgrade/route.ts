import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, getTierFromPriceId, getTierRank } from "@/lib/stripe";
import { getUserProfile } from "@/lib/db";

/**
 * Preview the prorated charge for upgrading to a new plan.
 * Returns the amount in cents and formatted for display.
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

  const newTier = getTierFromPriceId(priceId);
  if (!newTier || newTier === "free") {
    return NextResponse.json(
      { error: "Invalid price ID" },
      { status: 400 }
    );
  }

  const userId = session.user.id as string;
  const profile = await getUserProfile(userId);

  if (!profile?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 }
    );
  }

  const sub = await stripe.subscriptions.retrieve(
    profile.stripeSubscriptionId,
    { expand: ["items.data.price"] }
  );

  if (!["active", "trialing"].includes(sub.status)) {
    return NextResponse.json(
      { error: "Subscription is not active" },
      { status: 400 }
    );
  }

  const currentPriceId = sub.items?.data?.[0]?.price?.id;
  const currentTier = currentPriceId ? getTierFromPriceId(currentPriceId) : null;
  const currentTierRank = currentTier ? getTierRank(currentTier) : 0;
  const newTierRank = getTierRank(newTier);

  if (currentTier === newTier || newTierRank <= currentTierRank) {
    return NextResponse.json(
      { error: "Not an upgrade" },
      { status: 400 }
    );
  }

  const subscriptionItemId = sub.items?.data?.[0]?.id;
  if (!subscriptionItemId) {
    return NextResponse.json(
      { error: "Could not find subscription item" },
      { status: 500 }
    );
  }

  try {
    const prorationDate = Math.floor(Date.now() / 1000);
    const preview = await stripe.invoices.createPreview({
      customer: sub.customer as string,
      subscription: profile.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: subscriptionItemId,
            price: priceId,
          },
        ],
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
      },
    });

    const amountDue = preview.amount_due ?? 0;
    const currency = (preview.currency ?? "usd").toUpperCase();

    return NextResponse.json({
      amountCents: amountDue,
      amountFormatted: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: preview.currency ?? "usd",
      }).format(amountDue / 100),
      currency,
      tier: newTier,
    });
  } catch (err) {
    console.error("[Stripe preview-upgrade]", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to preview upgrade",
      },
      { status: 500 }
    );
  }
}
