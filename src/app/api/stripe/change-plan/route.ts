import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, getTierFromPriceId, getTierRank } from "@/lib/stripe";
import {
  ensureUser,
  getUserProfile,
  updateSubscriptionFromStripe,
} from "@/lib/db";
import { shouldWaiveUpgradeProration } from "@/lib/stripe-upgrade-proration";

/**
 * Change subscription plan (upgrade or downgrade).
 * - Upgrade: Immediate tier change; proration invoiced unless preview amount is
 *   below UPGRADE_PRORATION_WAIVER_THRESHOLD_CENTS (default 100 = under $1 USD),
 *   in which case proration_behavior "none" applies (no charge today; same renewal).
 * - Downgrade: Scheduled for end of current billing period (no change until then).
 * - Ensures only one active subscription per customer.
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

  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const profile = await getUserProfile(userId);

    if (!profile?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription. Use checkout to subscribe first." },
        { status: 400 }
      );
    }

    const sub = await stripe.subscriptions.retrieve(
      profile.stripeSubscriptionId,
      { expand: ["items.data.price", "schedule"] }
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

    if (currentTier === newTier) {
      return NextResponse.json(
        { error: "Already on this plan" },
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

    if (newTierRank > currentTierRank) {
      const prorationDate = Math.floor(Date.now() / 1000);
      const preview = await stripe.invoices.createPreview({
        customer: sub.customer as string,
        subscription: profile.stripeSubscriptionId,
        subscription_details: {
          items: [{ id: subscriptionItemId, price: priceId }],
          proration_behavior: "always_invoice",
          proration_date: prorationDate,
        },
      });
      const invoiceAmountCents = preview.amount_due ?? 0;
      const waive = shouldWaiveUpgradeProration(invoiceAmountCents);

      if (waive) {
        await stripe.subscriptionItems.update(subscriptionItemId, {
          price: priceId,
          proration_behavior: "none",
        });
      } else {
        await stripe.subscriptionItems.update(subscriptionItemId, {
          price: priceId,
          proration_behavior: "always_invoice",
          proration_date: prorationDate,
          payment_behavior: "error_if_incomplete",
        });
      }

      const updated = await stripe.subscriptions.retrieve(
        profile.stripeSubscriptionId,
        { expand: ["items.data.price"] }
      );
      const updatedPriceId =
        typeof updated.items.data[0]?.price?.id === "string"
          ? updated.items.data[0].price.id
          : updated.items.data[0]?.price?.id ?? null;

      await updateSubscriptionFromStripe(userId, {
        stripeSubscriptionStatus: updated.status,
        stripePriceId: updatedPriceId,
        subscriptionTier: newTier,
        tierUpgradeAt: new Date().toISOString(),
        tierBeforeUpgrade: currentTier ?? undefined,
      });

      return NextResponse.json({
        success: true,
        tier: newTier,
        prorationWaived: waive,
        message: waive
          ? "Plan upgraded. No charge today — your new benefits apply now, and your renewal date stays the same."
          : "Plan upgraded. Prorated charge applied.",
      });
    }

    // Downgrade: schedule change at end of current period
    const periodEnd = sub.items?.data?.[0]?.current_period_end;
    if (typeof periodEnd !== "number") {
      return NextResponse.json(
        { error: "Could not determine billing period end" },
        { status: 500 }
      );
    }

    // If subscription already has a schedule, release it first so we can create a new one
    const existingScheduleId =
      typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
    if (existingScheduleId) {
      await stripe.subscriptionSchedules.release(existingScheduleId);
      // Re-fetch subscription after release
      const subAfterRelease = await stripe.subscriptions.retrieve(
        profile.stripeSubscriptionId,
        { expand: ["items.data.price"] }
      );
      const currentPrice = subAfterRelease.items?.data?.[0]?.price?.id;
      const periodStart = subAfterRelease.items?.data?.[0]?.current_period_start;
      const periodEndAfter = subAfterRelease.items?.data?.[0]?.current_period_end;
      if (!currentPrice || typeof periodStart !== "number" || typeof periodEndAfter !== "number") {
        return NextResponse.json(
          { error: "Could not update schedule" },
          { status: 500 }
        );
      }

      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: profile.stripeSubscriptionId,
      });

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          {
            items: [{ price: currentPrice, quantity: 1 }],
            start_date: periodStart,
            end_date: periodEndAfter,
          },
          {
            items: [{ price: priceId, quantity: 1 }],
            start_date: periodEndAfter,
          },
        ],
        metadata: { userId, tier: newTier },
      });

      return NextResponse.json({
        success: true,
        tier: newTier,
        effectiveAt: new Date(periodEndAfter * 1000).toISOString(),
        message:
          "Downgrade scheduled for end of billing period. You keep current plan until then.",
      });
    }

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: profile.stripeSubscriptionId,
    });

    const currentPrice = sub.items?.data?.[0]?.price?.id;
    if (!currentPrice) {
      return NextResponse.json(
        { error: "Could not determine current price" },
        { status: 500 }
      );
    }

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPrice, quantity: 1 }],
          start_date: sub.items.data[0].current_period_start,
          end_date: periodEnd,
        },
        {
          items: [{ price: priceId, quantity: 1 }],
          start_date: periodEnd,
        },
      ],
      metadata: { userId, tier: newTier },
    });

    return NextResponse.json({
      success: true,
      tier: newTier,
      effectiveAt: new Date(periodEnd * 1000).toISOString(),
      message:
        "Downgrade scheduled for end of billing period. You keep current plan until then.",
    });
  } catch (err) {
    console.error("[Stripe change-plan]", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to change plan",
      },
      { status: 500 }
    );
  }
}
