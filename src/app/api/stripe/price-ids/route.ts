import { NextResponse } from "next/server";
import { getStripePriceIds } from "@/lib/stripe";

/** Returns Stripe price IDs for the current environment (sandbox or live). */
export async function GET() {
  const priceIds = getStripePriceIds();
  return NextResponse.json(priceIds);
}
