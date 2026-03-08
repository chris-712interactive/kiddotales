import { NextResponse } from "next/server";

/** Temporary debug route - remove before production. */
export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return NextResponse.json({
    stripeConfigured: !!secretKey,
    secretKeySet: secretKey?.length > 0,
    hint: !secretKey
      ? "STRIPE_SECRET_KEY not found. Check .env is in project root and restart dev server."
      : "Key is loaded. If checkout still fails, the key may be invalid.",
  });
}
