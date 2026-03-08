import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, getTierFromPriceId } from "@/lib/stripe";
import { updateSubscriptionFromStripe } from "@/lib/db";

/**
 * Sync subscription from Stripe to our DB.
 * Looks up customer by email and updates our records (fallback when webhook misses).
 */
export async function POST() {
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

  const userId = session.user.id as string;
  const email = session.user.email;

  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No Stripe customer found for this email" },
        { status: 404 }
      );
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      const trialing = await stripe.subscriptions.list({
        customer: customer.id,
        status: "trialing",
        limit: 1,
      });
      if (trialing.data.length === 0) {
        return NextResponse.json(
          { error: "No active subscription found" },
          { status: 404 }
        );
      }
      subscriptions.data = trialing.data;
    }

    const sub = subscriptions.data[0];
    const priceId =
      typeof sub.items.data[0]?.price?.id === "string"
        ? sub.items.data[0].price.id
        : sub.items.data[0]?.price?.id ?? null;

    const tier = priceId ? getTierFromPriceId(priceId) : null;

    await updateSubscriptionFromStripe(userId, {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
      stripePriceId: priceId,
      subscriptionTier: tier ?? "spark",
    });

    return NextResponse.json({ success: true, tier: tier ?? "spark" });
  } catch (err) {
    console.error("[Stripe sync]", err);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}
