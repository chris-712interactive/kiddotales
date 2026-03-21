import { NextResponse } from "next/server";
import { getStripe, isStripeLiveMode } from "@/lib/stripe";

/** Temporary debug route - disabled in production. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const stripe = getStripe();
  return NextResponse.json({
    stripeConfigured: !!stripe,
    liveMode: isStripeLiveMode(),
    hint: !stripe
      ? "STRIPE_SECRET_KEY (or STRIPE_SECRET_KEY_LIVE in prod) not found. Check .env and restart dev server."
      : "Key is loaded. If checkout still fails, the key may be invalid.",
  });
}
