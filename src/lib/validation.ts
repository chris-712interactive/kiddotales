/**
 * Server-side validation for create form payloads
 */

const VALID_ART_STYLES = new Set([
  "whimsical-watercolor",
  "pixar-3d",
  "hand-drawn-classic",
  "vibrant-cartoon",
]);

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateCreatePayload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const b = body as Record<string, unknown>;

  const childName = typeof b.childName === "string" ? b.childName.trim() : "";
  if (!childName) {
    return { ok: false, error: "Child name is required." };
  }
  if (childName.length > 50) {
    return { ok: false, error: "Child name must be 50 characters or less." };
  }

  const age = typeof b.age === "number" ? b.age : typeof b.age === "string" ? parseInt(b.age, 10) : NaN;
  if (Number.isNaN(age) || age < 1 || age > 12) {
    return { ok: false, error: "Age must be between 1 and 12." };
  }

  const interests = Array.isArray(b.interests) ? b.interests : [];
  if (interests.length === 0) {
    return { ok: false, error: "At least one interest is required." };
  }
  if (interests.length > 10) {
    return { ok: false, error: "Maximum 10 interests allowed." };
  }
  for (let i = 0; i < interests.length; i++) {
    const item = interests[i];
    if (typeof item !== "string" || item.trim().length === 0) {
      return { ok: false, error: "Each interest must be a non-empty string." };
    }
    if (item.length > 40) {
      return { ok: false, error: "Each interest must be 40 characters or less." };
    }
  }

  const lifeLesson = typeof b.lifeLesson === "string" ? b.lifeLesson.trim() : "kindness";
  if (!lifeLesson || lifeLesson.length > 50) {
    return { ok: false, error: "Life lesson must be 1–50 characters." };
  }

  const artStyle = typeof b.artStyle === "string" ? b.artStyle : "whimsical-watercolor";
  if (!VALID_ART_STYLES.has(artStyle)) {
    return { ok: false, error: "Invalid art style." };
  }

  const pronouns = typeof b.pronouns === "string" ? b.pronouns : "they/them";
  if (pronouns.length > 30) {
    return { ok: false, error: "Pronouns must be 30 characters or less." };
  }

  return { ok: true };
}
