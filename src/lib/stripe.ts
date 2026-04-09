import Stripe from "stripe";
import {
  getTierCapabilities,
  TTS_DEFAULT_VOICE,
  TTS_VOICES_MAGIC,
  TTS_VOICES_LEGEND,
} from "./entitlements";

export type BookLimitPeriod = "total" | "monthly";

/** Whether to use live Stripe keys/prices (production only). Use sandbox otherwise. */
export function isStripeLiveMode(): boolean {
  // Vercel: production deployment uses live; preview/development use sandbox
  if (process.env.VERCEL_ENV === "production") return true;
  // Explicit override for non-Vercel production (e.g. `STRIPE_USE_LIVE=true`)
  if (process.env.STRIPE_USE_LIVE === "true") return true;
  return false;
}

/** Get Stripe secret key for current environment (sandbox or live). */
function getStripeSecretKey(): string | undefined {
  const useLive = isStripeLiveMode();
  return useLive
    ? process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
}

/** Get Stripe webhook secret for current environment. */
export function getStripeWebhookSecret(): string | undefined {
  const useLive = isStripeLiveMode();
  return useLive
    ? process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;
}

/** Get Stripe price IDs for current environment (sandbox or live). */
export function getStripePriceIds(): {
  spark: { monthly?: string; yearly?: string };
  magic: { monthly?: string; yearly?: string };
  legend: { monthly?: string; yearly?: string };
} {
  const useLive = isStripeLiveMode();
  const suffix = useLive ? "_LIVE" : "";
  return {
    spark: {
      monthly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_SPARK_MONTHLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_MONTHLY,
      yearly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_SPARK_YEARLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_SPARK_YEARLY,
    },
    magic: {
      monthly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_MAGIC_MONTHLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_MONTHLY,
      yearly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_MAGIC_YEARLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_MAGIC_YEARLY,
    },
    legend: {
      monthly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_LEGEND_MONTHLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_LEGEND_MONTHLY,
      yearly: process.env[`NEXT_PUBLIC_STRIPE_PRICE_LEGEND_YEARLY${suffix}`] ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_LEGEND_YEARLY,
    },
  };
}

/** Get Stripe gift (one-time) price IDs for current environment. */
export function getStripeGiftPriceIds(): {
  spark: { monthly?: string; yearly?: string };
  magic: { monthly?: string; yearly?: string };
  legend: { monthly?: string; yearly?: string };
} {
  const useLive = isStripeLiveMode();
  const suffix = useLive ? "_LIVE" : "";
  return {
    spark: {
      monthly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_SPARK_MONTHLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_SPARK_MONTHLY,
      yearly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_SPARK_YEARLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_SPARK_YEARLY,
    },
    magic: {
      monthly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_MAGIC_MONTHLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_MAGIC_MONTHLY,
      yearly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_MAGIC_YEARLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_MAGIC_YEARLY,
    },
    legend: {
      monthly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_LEGEND_MONTHLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_LEGEND_MONTHLY,
      yearly:
        process.env[`NEXT_PUBLIC_STRIPE_GIFT_PRICE_LEGEND_YEARLY${suffix}`] ??
        process.env.NEXT_PUBLIC_STRIPE_GIFT_PRICE_LEGEND_YEARLY,
    },
  };
}

/** Subscription tiers and their limits/features */
const FREE_CAPS = getTierCapabilities("free");
const SPARK_CAPS = getTierCapabilities("spark");
const MAGIC_CAPS = getTierCapabilities("magic");
const LEGEND_CAPS = getTierCapabilities("legend");

export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    bookLimit: FREE_CAPS.bookLimit,
    bookLimitPeriod: FREE_CAPS.bookLimitPeriod as BookLimitPeriod,
    voiceLimit: FREE_CAPS.voiceLimit,
    priceMonthly: null,
    priceYearly: null,
    features: [
      `Up to ${FREE_CAPS.bookLimit} book generations total`,
      "Basic generation",
      "Limited art styles",
    ],
  },
  spark: {
    id: "spark",
    name: "Spark",
    bookLimit: SPARK_CAPS.bookLimit,
    bookLimitPeriod: SPARK_CAPS.bookLimitPeriod as BookLimitPeriod,
    voiceLimit: SPARK_CAPS.voiceLimit,
    priceMonthly: 6.99,
    priceYearly: 69,
    features: [
      `Up to ${SPARK_CAPS.bookLimit} book generations/month`,
      "No watermark",
      "Full art styles",
      "Save last 10 books",
      "Basic PDF",
      "AI voice read-aloud",
      "Edit Book"
    ],
    priceIdMonthly: undefined, // Use getStripePriceIds() for env-aware IDs
    priceIdYearly: undefined,
  },
  magic: {
    id: "magic",
    name: "Magic",
    bookLimit: MAGIC_CAPS.bookLimit,
    bookLimitPeriod: MAGIC_CAPS.bookLimitPeriod as BookLimitPeriod,
    voiceLimit: MAGIC_CAPS.voiceLimit,
    priceMonthly: 11.99,
    priceYearly: 119,
    features: [
      `Up to ${MAGIC_CAPS.bookLimit} book generations/month`,
      "Everything in Spark",
      "Priority generation",
      "Voice input",
      "Regenerate single page",
      "Full history/journal (unlimited saves)",
      "Premium PDF layouts (cover + extras)",
      "3 voice options",
    ],
    priceIdMonthly: undefined,
    priceIdYearly: undefined,
  },
  legend: {
    id: "legend",
    name: "Legend",
    bookLimit: LEGEND_CAPS.bookLimit,
    bookLimitPeriod: LEGEND_CAPS.bookLimitPeriod as BookLimitPeriod,
    voiceLimit: LEGEND_CAPS.voiceLimit,
    priceMonthly: 16.99,
    priceYearly: 169,
    features: [
      `Up to ${LEGEND_CAPS.bookLimit} book generations/month`,
      "Everything in Magic",
      "Multi-child profiles (up to 5 kids)",
      "Family sharing (invite 2 others)",
      "Custom lesson packs",
      "All voice options",
      "Highest priority",
      "Commercial-use rights for teachers/daycares (limited)",
    ],
    priceIdMonthly: undefined,
    priceIdYearly: undefined,
  },
} as const;

export type SubscriptionTierId = keyof typeof SUBSCRIPTION_TIERS;

/** Get book limit and period for a tier */
export function getBookLimitForTier(tier: string): {
  limit: number;
  period: BookLimitPeriod;
} {
  const config = getTierCapabilities(tier);
  return {
    limit: config.bookLimit,
    period: config.bookLimitPeriod,
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

/** Get Stripe price ID for a tier (for admin/manual subscription updates). Uses env-aware IDs. */
export function getPriceIdForTier(
  tier: string,
  period: "monthly" | "yearly" = "monthly"
): string | null {
  if (tier === "free") return null;
  const prices = getStripePriceIds();
  const tierPrices = prices[tier as keyof typeof prices];
  if (!tierPrices) return null;
  return (period === "yearly" ? tierPrices.yearly : tierPrices.monthly) ?? null;
}

/** Map Stripe price ID to tier. Uses env-aware price IDs. */
export function getTierFromPriceId(priceId: string): SubscriptionTierId | null {
  const prices = getStripePriceIds();
  const priceMap: Record<string, SubscriptionTierId> = {};
  for (const [tier, p] of Object.entries(prices)) {
    if (p.monthly) priceMap[p.monthly] = tier as SubscriptionTierId;
    if (p.yearly) priceMap[p.yearly] = tier as SubscriptionTierId;
  }
  return priceMap[priceId] ?? null;
}

/** Get Stripe instance (server-side only). Uses env-aware secret key. */
export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

/** AI voice limits by tier (books with AI voice per month) */
export function getVoiceLimitForTier(tier: string): number {
  return getTierCapabilities(tier).voiceLimit;
}

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
  return [...getTierCapabilities(tier).allowedVoices];
}

export { TTS_DEFAULT_VOICE, TTS_VOICES_MAGIC, TTS_VOICES_LEGEND };
