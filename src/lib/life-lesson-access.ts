import type { LessonPackAccess } from "./entitlements";
import { EXTENDED_LIFE_LESSONS, LIFE_LESSONS } from "@/types";

const BASE_SET = new Set<string>(LIFE_LESSONS);
const EXTENDED_SET = new Set<string>(EXTENDED_LIFE_LESSONS);

export function isPresetLifeLessonSlug(
  slug: string,
  access: LessonPackAccess
): boolean {
  if (BASE_SET.has(slug)) return true;
  if (access === "custom" && EXTENDED_SET.has(slug)) return true;
  return false;
}

/**
 * Server-side: default = base presets only; custom = base + extended presets or any 1–50 char custom phrase.
 */
export function validateLifeLessonForAccess(
  lifeLesson: string,
  access: LessonPackAccess
): { ok: true } | { ok: false; error: string } {
  const trimmed = lifeLesson.trim();
  if (!trimmed || trimmed.length > 50) {
    return { ok: false, error: "Life lesson must be 1–50 characters." };
  }
  if (access === "default") {
    if (!BASE_SET.has(trimmed)) {
      return {
        ok: false,
        error:
          "Your plan includes the standard lesson themes only. Upgrade to Legend for custom lessons and expanded lesson packs.",
      };
    }
    return { ok: true };
  }
  return { ok: true };
}
