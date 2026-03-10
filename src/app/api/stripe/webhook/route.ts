import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getTierFromPriceId } from "@/lib/stripe";
import { updateSubscriptionFromStripe } from "@/lib/db";

/** Stripe webhook handler. Must use raw body for signature verification. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.error("[Stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[Stripe webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("[Stripe webhook] checkout.session.completed: no userId in metadata");
          break;
        }

        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;

        const tier = priceId ? getTierFromPriceId(priceId) : null;

        await updateSubscriptionFromStripe(userId, {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: tier ?? "spark",
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;

        const tier = priceId ? getTierFromPriceId(priceId) : null;
        const activeStatuses = ["active", "trialing"];

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: activeStatuses.includes(sub.status)
            ? (tier ?? "spark")
            : "free",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: "canceled",
          stripePriceId: null,
          subscriptionTier: "free",
        });
        break;
      }

      case "subscription_schedule.updated":
      case "subscription_schedule.completed":
      case "subscription_schedule.released": {
        // When a schedule phases (e.g. downgrade takes effect), sync our DB
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        const userId = schedule.metadata?.userId;
        if (!userId || !schedule.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          schedule.subscription as string,
          { expand: ["items.data.price"] }
        );
        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;
        const tier = priceId ? getTierFromPriceId(priceId) : null;
        const activeStatuses = ["active", "trialing"];

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: activeStatuses.includes(sub.status)
            ? (tier ?? "spark")
            : "free",
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("[Stripe webhook] invoice.payment_failed:", invoice.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe webhook] Handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
