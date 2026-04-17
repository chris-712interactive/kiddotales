import type { CharacterAppearance } from "@/types";

const HAIR_COLOR_VALUES = new Set([
  "blonde",
  "brown",
  "black",
  "red",
  "auburn",
]);
const HAIR_STYLE_VALUES = new Set([
  "short",
  "long",
  "curly",
  "straight",
  "pigtails",
  "braids",
  "ponytail",
]);
const SKIN_VALUES = new Set(["light", "medium", "tan", "brown", "dark"]);
const EYE_VALUES = new Set(["blue", "brown", "green", "hazel"]);
const CLOTHING_PATTERN =
  /\b(outfit|wearing|wears|dressed|dress|shirt|t-?shirt|sweater|hoodie|jacket|coat|cardigan|jeans|pants|trousers|shorts|skirt|leggings|shoes|sneakers|boots|sandals|pajamas|uniform|fabric|sleeve|collar|neckline)\b/i;

function pickEnum(raw: unknown, allowed: Set<string>): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (allowed.has(v)) return v;
  return undefined;
}

function stripClothingContent(input: string): string {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter((s) => !CLOTHING_PATTERN.test(s));
  const normalized = (kept.length ? kept : sentences).join(" ").trim();
  return normalized.slice(0, 2500);
}

export type PhotoAppearanceAnalysis = {
  appearance: CharacterAppearance;
  detailedCharacterDescription: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export function sanitizePhotoAnalysisJson(parsed: unknown): PhotoAppearanceAnalysis | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const app = o.appearance && typeof o.appearance === "object" ? (o.appearance as Record<string, unknown>) : {};

  const appearance: CharacterAppearance = {
    hairColor: pickEnum(app.hairColor, HAIR_COLOR_VALUES),
    hairStyle: pickEnum(app.hairStyle, HAIR_STYLE_VALUES),
    skinTone: pickEnum(app.skinTone, SKIN_VALUES),
    eyeColor: pickEnum(app.eyeColor, EYE_VALUES),
    glasses: app.glasses === true,
    freckles: app.freckles === true,
  };

  const detailed =
    typeof o.detailedCharacterDescription === "string"
      ? stripClothingContent(o.detailedCharacterDescription.trim())
      : "";
  if (!detailed) return null;

  const conf = o.confidence === "high" || o.confidence === "medium" || o.confidence === "low" ? o.confidence : "medium";
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string").map((w) => w.slice(0, 200)).slice(0, 8)
    : [];

  return {
    appearance,
    detailedCharacterDescription: detailed,
    confidence: conf,
    warnings,
  };
}
