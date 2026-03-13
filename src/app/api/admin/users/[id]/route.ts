import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getStripe, SUBSCRIPTION_TIERS } from "@/lib/stripe";
import { getUserProfile, updateSubscriptionFromStripe } from "@/lib/db";

const VALID_TIERS = new Set(Object.keys(SUBSCRIPTION_TIERS));

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { subscriptionTier } = body as { subscriptionTier?: string };

    if (!subscriptionTier || typeof subscriptionTier !== "string") {
      return NextResponse.json(
        { error: "subscriptionTier is required" },
        { status: 400 }
      );
    }
    if (!VALID_TIERS.has(subscriptionTier)) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 }
      );
    }

    const profile = await getUserProfile(id);
    const stripe = getStripe();

    if (profile?.stripeSubscriptionId && subscriptionTier !== "free") {
      return NextResponse.json(
        { error: "Admin can only cancel paid subscriptions. User must change plan in Settings." },
        { status: 400 }
      );
    }

    if (subscriptionTier === "free") {
      if (stripe && profile?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(profile.stripeSubscriptionId);
        } catch (stripeErr) {
          console.error("Admin cancel subscription:", stripeErr);
          const msg =
            stripeErr && typeof stripeErr === "object" && "message" in stripeErr
              ? String((stripeErr as { message: string }).message)
              : "Failed to cancel Stripe subscription";
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      }
      await updateSubscriptionFromStripe(id, {
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripePriceId: null,
        tierUpgradeAt: null,
        tierBeforeUpgrade: null,
      });
      return NextResponse.json({ ok: true });
    }

    if (!profile?.stripeSubscriptionId) {
      await updateSubscriptionFromStripe(id, {
        subscriptionTier,
        tierUpgradeAt: new Date().toISOString(),
        tierBeforeUpgrade: profile?.subscriptionTier ?? undefined,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/users/[id]:", e);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  if ((session.user as { id?: string }).id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) {
      console.error("Admin DELETE user error:", error);
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/users/[id]:", e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
