export type BookLimitPeriod = "total" | "monthly";
export type TierId = "free" | "spark" | "magic" | "legend";
export type CorrectionMode = "none" | "name-only" | "full-regenerate" | "single-page";
export type PdfLevel = "basic" | "premium";
export type LessonPackAccess = "default" | "custom";
import { ART_STYLE_IDS, type ArtStyleId } from "./art-style-catalog";
export type { ArtStyleId } from "./art-style-catalog";

export const ALL_ART_STYLES: ArtStyleId[] = [...ART_STYLE_IDS];

export const TTS_DEFAULT_VOICE = "nova";
export const TTS_VOICES_MAGIC = ["nova", "alloy", "shimmer"] as const;
export const TTS_VOICES_LEGEND = [
  "alloy", "ash", "coral", "echo", "fable",
  "nova", "onyx", "sage", "shimmer",
] as const;

export type TierCapabilities = {
  tier: TierId;
  bookLimit: number;
  bookLimitPeriod: BookLimitPeriod;
  voiceLimit: number;
  allowedVoices: string[];
  allowedArtStyles: ArtStyleId[];
  correctionMode: CorrectionMode;
  historyLimit: number;
  pdfLevel: PdfLevel;
  maxChildProfiles: number;
  sharingSeats: number;
  lessonPackAccess: LessonPackAccess;
  priorityWeight: number;
  commercialUse: boolean;
  /** Optional child photo upload to generate a detailed reusable character description (transient photo). */
  photoAppearanceImport: boolean;
};

function parseNonNegativeIntEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function monthlyBookLimitForTier(tier: "spark" | "magic" | "legend", fallback: number): number {
  let pub: string | undefined;
  let server: string | undefined;
  if (tier === "spark") {
    pub = process.env.NEXT_PUBLIC_MONTHLY_BOOK_LIMIT_SPARK;
    server = process.env.MONTHLY_BOOK_LIMIT_SPARK;
  } else if (tier === "magic") {
    pub = process.env.NEXT_PUBLIC_MONTHLY_BOOK_LIMIT_MAGIC;
    server = process.env.MONTHLY_BOOK_LIMIT_MAGIC;
  } else {
    pub = process.env.NEXT_PUBLIC_MONTHLY_BOOK_LIMIT_LEGEND;
    server = process.env.MONTHLY_BOOK_LIMIT_LEGEND;
  }
  return parseNonNegativeIntEnv(pub, parseNonNegativeIntEnv(server, fallback));
}

function freeBookLimitFromEnv(): number {
  return parseNonNegativeIntEnv(
    process.env.NEXT_PUBLIC_BOOK_LIMIT_PER_USER ?? process.env.BOOK_LIMIT_PER_USER,
    3
  );
}

function normalizeTier(tier: string): TierId {
  if (tier === "spark" || tier === "magic" || tier === "legend") return tier;
  return "free";
}

function baselineCapabilities(tier: TierId): TierCapabilities {
  const freeBookLimit = freeBookLimitFromEnv();
  const sparkBookLimit = monthlyBookLimitForTier("spark", 12);
  const magicBookLimit = monthlyBookLimitForTier("magic", 35);
  const legendBookLimit = monthlyBookLimitForTier("legend", 75);

  if (tier === "spark") {
    return {
      tier,
      bookLimit: sparkBookLimit,
      bookLimitPeriod: "monthly",
      voiceLimit: 5,
      allowedVoices: [TTS_DEFAULT_VOICE],
      allowedArtStyles: [...ALL_ART_STYLES],
      correctionMode: "full-regenerate",
      historyLimit: 10,
      pdfLevel: "basic",
      maxChildProfiles: 3,
      sharingSeats: 0,
      lessonPackAccess: "default",
      priorityWeight: 1,
      commercialUse: false,
      photoAppearanceImport: false,
    };
  }

  if (tier === "magic") {
    return {
      tier,
      bookLimit: magicBookLimit,
      bookLimitPeriod: "monthly",
      voiceLimit: 10,
      allowedVoices: [...TTS_VOICES_MAGIC],
      allowedArtStyles: [...ALL_ART_STYLES],
      correctionMode: "single-page",
      historyLimit: 500,
      pdfLevel: "premium",
      maxChildProfiles: 3,
      sharingSeats: 0,
      lessonPackAccess: "default",
      priorityWeight: 2,
      commercialUse: false,
      photoAppearanceImport: true,
    };
  }

  if (tier === "legend") {
    return {
      tier,
      bookLimit: legendBookLimit,
      bookLimitPeriod: "monthly",
      voiceLimit: 15,
      allowedVoices: [...TTS_VOICES_LEGEND],
      allowedArtStyles: [...ALL_ART_STYLES],
      correctionMode: "single-page",
      historyLimit: 500,
      pdfLevel: "premium",
      maxChildProfiles: 5,
      sharingSeats: 2,
      lessonPackAccess: "custom",
      priorityWeight: 3,
      commercialUse: true,
      photoAppearanceImport: true,
    };
  }

  return {
    tier,
    bookLimit: freeBookLimit,
    bookLimitPeriod: "total",
    voiceLimit: 0,
    allowedVoices: [],
    allowedArtStyles: ["whimsical-watercolor", "vibrant-cartoon"],
    correctionMode: "none",
    historyLimit: 3,
    pdfLevel: "basic",
    maxChildProfiles: 1,
    sharingSeats: 0,
    lessonPackAccess: "default",
    priorityWeight: 0,
    commercialUse: false,
    photoAppearanceImport: false,
  };
}

/** Single source of truth for product capabilities by subscription tier. */
export function getTierCapabilities(tier: string): TierCapabilities {
  return baselineCapabilities(normalizeTier(tier));
}

/**
 * Rolling per-minute cap for POST /api/generate (server in-memory limiter).
 * Scales with {@link TierCapabilities.priorityWeight} so paid tiers can burst more safely under load.
 */
export function maxGenerateRequestsPerMinuteForTier(tier: string): number {
  const w = getTierCapabilities(tier).priorityWeight;
  return 3 + w * 2;
}
