import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getUserProfile,
  updateUserProfile,
  getUserBookCountByPeriod,
  getBookLimitForUser,
} from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const [profile, limitConfig] = await Promise.all([
      getUserProfile(userId),
      getBookLimitForUser(userId),
    ]);

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const bookCount = await getUserBookCountByPeriod(userId, limitConfig.period);

    let nextBillingDate: string | null = null;
    let subscriptionStatus: string | null = null;
    let cancelAtPeriodEnd = false;

    if (profile.stripeSubscriptionId) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(
            profile.stripeSubscriptionId,
            { expand: ["items.data.price"] }
          );
          subscriptionStatus = sub.status;
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          if (sub.current_period_end) {
            nextBillingDate = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch {
          // Ignore Stripe errors; we'll show what we have
        }
      }
    }

    return NextResponse.json({
      profile: {
        ...profile,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      },
      bookCount,
      bookLimit: limitConfig.limit,
      bookLimitPeriod: limitConfig.period,
      subscriptionTier: profile.subscriptionTier,
      theme: profile.theme,
      nextBillingDate,
      subscriptionStatus,
      cancelAtPeriodEnd,
    });
  } catch (e) {
    console.error("GET /api/user/settings:", e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  let body: {
    displayName?: string | null;
    phone?: string | null;
    theme?: "light" | "dark";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const updated = await updateUserProfile(userId, {
      displayName: body.displayName,
      phone: body.phone,
      theme: body.theme,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: updated });
  } catch (e) {
    console.error("PATCH /api/user/settings:", e);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
