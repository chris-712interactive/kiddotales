import type { CharacterAppearance } from "@/types";

/** Strip scene sentences that try to change wardrobe; keeps action/setting focused. */
export function normalizeScenePromptForWardrobe(scenePrompt: string): string {
  if (!scenePrompt) return "";
  const clothingPattern =
    /\b(outfit|wearing|wears|dressed|dress|shirt|t-?shirt|sweater|hoodie|jacket|coat|cardigan|jeans|pants|trousers|shorts|skirt|leggings|shoes|sneakers|boots|sandals|pajamas|costume|uniform)\b/i;
  const sentenceSplit = scenePrompt
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentenceSplit.filter((s) => !clothingPattern.test(s));
  const normalized = (kept.length ? kept : sentenceSplit).join(" ");
  return normalized.trim();
}

/** Face/hair/skin traits only — no outfit line (use with story `illustrationOutfitLock`). */
export function buildTraitLockSuffix(appearance?: CharacterAppearance): string | null {
  if (!appearance || typeof appearance !== "object") return null;
  const a = appearance as Record<string, unknown>;
  const hasAny =
    a.hairColor || a.hairStyle || a.skinTone || a.eyeColor || a.glasses || a.freckles;
  if (!hasAny) return null;

  const parts: string[] = [];

  const hair: string[] = [];
  if (a.hairColor && typeof a.hairColor === "string") hair.push(a.hairColor);
  if (a.hairStyle && typeof a.hairStyle === "string") hair.push(a.hairStyle);
  if (hair.length) parts.push(`${hair.join(" ")} hair`);

  if (a.skinTone && typeof a.skinTone === "string") parts.push(`${a.skinTone} skin`);
  if (a.eyeColor && typeof a.eyeColor === "string") parts.push(`${a.eyeColor} eyes`);
  if (a.glasses) parts.push("wearing glasses");
  if (a.freckles) parts.push("freckles");

  return `Appearance lock: ${parts.join(", ")}, human ears, no animal features.`;
}

/** Parent appearance + default or custom outfit line for books without a story outfit lock. */
export function buildAppearanceLockSuffix(
  pronouns: string,
  appearance?: CharacterAppearance
): string | null {
  if (!appearance || typeof appearance !== "object") return null;
  const a = appearance as Record<string, unknown>;
  const hasAny =
    a.hairColor || a.hairStyle || a.skinTone || a.eyeColor || a.glasses || a.freckles;
  if (!hasAny) return null;

  const isGirl = /she\/her|girl/i.test(pronouns);
  const isBoy = /he\/him|boy/i.test(pronouns);
  const parts: string[] = [];

  const hair: string[] = [];
  if (a.hairColor && typeof a.hairColor === "string") hair.push(a.hairColor);
  if (a.hairStyle && typeof a.hairStyle === "string") hair.push(a.hairStyle);
  if (hair.length) parts.push(`${hair.join(" ")} hair`);

  if (a.skinTone && typeof a.skinTone === "string") parts.push(`${a.skinTone} skin`);
  if (a.eyeColor && typeof a.eyeColor === "string") parts.push(`${a.eyeColor} eyes`);
  if (a.glasses) parts.push("wearing glasses");
  if (a.freckles) parts.push("freckles");

  const customOutfit =
    typeof a.outfitLockSuggestion === "string" && a.outfitLockSuggestion.trim();
  const outfitLock = customOutfit
    ? `wearing the exact same outfit in every image: ${customOutfit.trim()}`
    : isGirl
      ? "wearing the exact same outfit in every image: a light pink cardigan over a pastel top, denim bottoms, white socks, and pink sneakers"
      : isBoy
        ? "wearing the exact same outfit in every image: a sky-blue tee, denim bottoms, white socks, and blue sneakers"
        : "wearing the exact same outfit in every image: a pastel tee, denim bottoms, white socks, and sneakers";

  return `Appearance lock: ${parts.join(", ")}, human ears, no animal features, ${outfitLock}.`;
}
