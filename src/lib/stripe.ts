import Stripe from "stripe";

export type BookLimitPeriod = "total" | "monthly";

/** Subscription tiers and their limits/features */
export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    bookLimit: 3,
    bookLimitPeriod: "total" as BookLimitPeriod,
    voiceLimit: 0,
    priceMonthly: null,
    priceYearly: null,
    features: [
      "Up to 3 books total",
      "Basic generation",
      "Limited art styles",
    ],
  },
  spark: {
    id: "spark",
    name: "Spark",
    bookLimit: 20,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    voiceLimit: 5,
    priceMonthly: 4.99,
    priceYearly: 49,
    features: [
      "Up to 20 books/month",
      "No watermark",
      "Full art styles",
      "Save last 10 books",
      "Basic PDF",
      "AI voice read-aloud",
      "Edit Book"
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_YEARLY,
  },
  magic: {
    id: "magic",
    name: "Magic",
    bookLimit: 60,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    voiceLimit: 10,
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
      "3 voice options",
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_YEARLY,
  },
  legend: {
    id: "legend",
    name: "Legend",
    bookLimit: 200,
    bookLimitPeriod: "monthly" as BookLimitPeriod,
    voiceLimit: 15,
    priceMonthly: 14.99,
    priceYearly: 149,
    features: [
      "Up to 200 books/month",
      "Everything in Magic",
      "Multi-child profiles (up to 5 kids)",
      "Family sharing (invite 2 others)",
      "Custom lesson packs",
      "All voice options",
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

/** Tier rank for upgrade/downgrade comparison (higher = more expensive) */
const TIER_RANK: Record<SubscriptionTierId, number> = {
  free: 0,
  spark: 1,
  magic: 2,
  legend: 3,
};

export function getTierRank(tier: string): number {
  return TIER_RANK[tier as SubscriptionTierId] ?? 0;
}

/** Get Stripe price ID for a tier (for admin/manual subscription updates) */
export function getPriceIdForTier(
  tier: string,
  period: "monthly" | "yearly" = "monthly"
): string | null {
  if (tier === "free") return null;
  const config = SUBSCRIPTION_TIERS[tier as SubscriptionTierId];
  if (!config) return null;
  const c = config as { priceIdMonthly?: string; priceIdYearly?: string };
  return (period === "yearly" ? c.priceIdYearly : c.priceIdMonthly) ?? null;
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

/** AI voice limits by tier (books with AI voice per month) */
export function getVoiceLimitForTier(tier: string): number {
  const t = SUBSCRIPTION_TIERS[tier as SubscriptionTierId];
  const config = t ?? SUBSCRIPTION_TIERS.free;
  return (config as { voiceLimit?: number }).voiceLimit ?? 0;
}

/** Default TTS voice (Spark's single voice) */
export const TTS_DEFAULT_VOICE = "nova";

/** Magic tier: 3 voice options */
export const TTS_VOICES_MAGIC = ["nova", "alloy", "shimmer"] as const;

/** Legend tier: all OpenAI TTS voices (tts-1 supports 9 voices only) */
export const TTS_VOICES_LEGEND = [
  "alloy", "ash", "coral", "echo", "fable",
  "nova", "onyx", "sage", "shimmer",
] as const;

/** Human-readable labels for voice selector */
export const TTS_VOICE_LABELS: Record<string, string> = {
  alloy: "Calm & clear",
  ash: "Soft & gentle",
  coral: "Bright & cheerful",
  echo: "Friendly & steady",
  fable: "Magical & whimsical",
  nova: "Warm & friendly",
  onyx: "Deep & reassuring",
  sage: "Wise & kind",
  shimmer: "Light & playful",
};

/** Get allowed voices for a tier */
export function getVoicesForTier(tier: string): string[] {
  if (tier === "legend") return [...TTS_VOICES_LEGEND];
  if (tier === "magic") return [...TTS_VOICES_MAGIC];
  if (tier === "spark") return [TTS_DEFAULT_VOICE];
  return [];
}
