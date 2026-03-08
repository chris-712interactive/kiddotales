import Stripe from "stripe";

export type BookLimitPeriod = "total" | "monthly";

/** Subscription tiers and their limits/features */
export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    bookLimit: 3,
    bookLimitPeriod: "total" as BookLimitPeriod,
    priceMonthly: null,
    priceYearly: null,
    features: [
      "Up to 3 books total",
      "Basic generation",
      "Watermarked images",
      "Limited art styles",
    ],
  },
  spark: {
    id: "spark",
    name: "Spark",
    bookLimit: 20,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    priceMonthly: 4.99,
    priceYearly: 49,
    features: [
      "Up to 20 books/month",
      "No watermark",
      "Full art styles",
      "Save last 10 books",
      "Basic PDF",
      "Read-aloud",
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_YEARLY,
  },
  magic: {
    id: "magic",
    name: "Magic",
    bookLimit: 60,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    priceMonthly: 9.99,
    priceYearly: 99,
    features: [
      "Up to 60 books/month",
      "Everything in Spark",
      "Priority generation",
      "Voice input",
      "Regenerate single page",
      "Full history/journal (unlimited saves)",
      "Premium PDF layouts (cover + extras)",
      "Early access to new styles/voices",
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_YEARLY,
  },
  legend: {
    id: "legend",
    name: "Legend",
    bookLimit: 200,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    priceMonthly: 14.99,
    priceYearly: 149,
    features: [
      "Up to 200 books/month",
      "Everything in Magic",
      "Multi-child profiles (up to 5 kids)",
      "Family sharing (invite 2 others)",
      "Custom lesson packs",
      "Highest priority",
      "Commercial-use rights for teachers/daycares (limited)",
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_LEGEND_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_LEGEND_YEARLY,
  },
} as const;

export type SubscriptionTierId = keyof typeof SUBSCRIPTION_TIERS;

/** Get book limit and period for a tier */
export function getBookLimitForTier(tier: string): {
  limit: number;
  period: BookLimitPeriod;
} {
  const t = SUBSCRIPTION_TIERS[tier as SubscriptionTierId];
  const config = t ?? SUBSCRIPTION_TIERS.free;
  return {
    limit: config.bookLimit,
    period: (config as { bookLimitPeriod?: BookLimitPeriod }).bookLimitPeriod ?? "total",
  };
}

/** Map Stripe price ID to tier */
export function getTierFromPriceId(priceId: string): SubscriptionTierId | null {
  const priceMap: Record<string, SubscriptionTierId> = {};
  for (const [tier, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier === "free") continue;
    const c = config as { priceIdMonthly?: string; priceIdYearly?: string };
    if (c.priceIdMonthly) priceMap[c.priceIdMonthly] = tier as SubscriptionTierId;
    if (c.priceIdYearly) priceMap[c.priceIdYearly] = tier as SubscriptionTierId;
  }
  return priceMap[priceId] ?? null;
}

/** Get Stripe instance (server-side only) */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
