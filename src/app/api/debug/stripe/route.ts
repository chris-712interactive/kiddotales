import { NextResponse } from "next/server";

/** Temporary debug route - disabled in production. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return NextResponse.json({
    stripeConfigured: !!secretKey,
    secretKeySet: (secretKey?.length ?? 0) > 0,
    hint: !secretKey
      ? "STRIPE_SECRET_KEY not found. Check .env is in project root and restart dev server."
      : "Key is loaded. If checkout still fails, the key may be invalid.",
  });
}
