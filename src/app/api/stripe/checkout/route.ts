import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getTierFromPriceId } from "@/lib/stripe";
import { ensureUser, getUserProfile } from "@/lib/db";

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

    // User already has a subscription in our DB - use change-plan, not new checkout
    if (profile?.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Use 'Manage subscription' to change your plan.",
        },
        { status: 400 }
      );
    }

    // Also check Stripe directly - user may have active subscriptions we don't know about
    // (e.g. webhook not fired yet, or created multiple in parallel)
    let stripeCustomerId = profile?.stripeCustomerId ?? undefined;

    if (stripeCustomerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "active",
        limit: 1,
      });
      if (existingSubs.data.length > 0) {
        return NextResponse.json(
          {
            error:
              "You already have an active subscription. Use 'Manage subscription' in Settings to change your plan.",
          },
          { status: 400 }
        );
      }
      // Also check trialing
      const trialingSubs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "trialing",
        limit: 1,
      });
      if (trialingSubs.data.length > 0) {
        return NextResponse.json(
          {
            error:
              "You already have an active subscription. Use 'Manage subscription' in Settings to change your plan.",
          },
          { status: 400 }
        );
      }
    } else {
      // No customer in our DB - check if Stripe has a customer with this email and active sub
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });
      if (customers.data.length > 0) {
        const customer = customers.data[0];
        stripeCustomerId = customer.id; // Use existing customer for checkout
        const existingSubs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 10,
        });
        const hasActive = existingSubs.data.some(
          (s) => s.status === "active" || s.status === "trialing"
        );
        if (hasActive) {
          return NextResponse.json(
            {
              error:
                "You already have an active subscription. Use 'Manage subscription' in Settings to change your plan.",
            },
            { status: 400 }
          );
        }
      }
    }

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
