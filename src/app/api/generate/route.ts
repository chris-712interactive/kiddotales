import { NextRequest, NextResponse } from "next/server";
import OpenAI, { RateLimitError } from "openai";
import Replicate from "replicate";
import {
  getStoryUserPrompt,
} from "@/lib/constants";
import { getArtStylePrompt } from "@/lib/art-style-catalog";
import type { BookData, BookPage, CharacterAppearance, ChildProfile } from "@/types";
import { STORY_SYSTEM_PROMPT } from "@/lib/prompts";
import { auth } from "@/auth";
import {
  ensureUser,
  getUserProfile,
  getUserBookCountByPeriod,
  insertBookUsageEvent,
  insertVoiceUsageEvent,
  saveBookToSupabase,
  replaceBook,
  getBookLimitForUser,
  getUserVoiceCountByPeriod,
  hasBookUsedVoiceSlot,
  updateBookPagesWithAudio,
  getChildProfileById,
} from "@/lib/db";
import {
  getVoiceLimitForTier,
  getVoicesForTier,
  TTS_DEFAULT_VOICE,
} from "@/lib/stripe";
import { getTierCapabilities, maxGenerateRequestsPerMinuteForTier } from "@/lib/entitlements";
import {
  resolveFamilyPlanContext,
  type FamilyPlanContext,
} from "@/lib/family-sharing";
import { validateLifeLessonForAccess } from "@/lib/life-lesson-access";
import { uploadImageToStorage, uploadAudioToStorage } from "@/lib/supabase-storage";
import { validateCreatePayload } from "@/lib/validation";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/** Cover + interior illustrations (BFL FLUX.2 Pro on Replicate). */
const REPLICATE_FLUX_IMAGE_MODEL =
  "black-forest-labs/flux-2-pro" as `${string}/${string}`;

/**
 * FLUX.2 Pro `resolution` (megapixels as a string, e.g. "4 MP"). Max 4 MP on Replicate.
 * Optional env REPLICATE_FLUX_RESOLUTION — e.g. "2 MP" for lower cost (at 4:5, output may cap below requested MP).
 */
const REPLICATE_FLUX_IMAGE_RESOLUTION =
  process.env.REPLICATE_FLUX_RESOLUTION?.trim() || "4 MP";

/**
 * FLUX.2 Pro safety_tolerance: 1 = strictest, 5 = most permissive.
 * Legitimate children's book prompts are often false-flagged at 1–2; default 4 reduces E005 noise.
 * Override with REPLICATE_FLUX_SAFETY_TOLERANCE (integer 1–5).
 */
function replicateFluxSafetyTolerance(): number {
  const raw = process.env.REPLICATE_FLUX_SAFETY_TOLERANCE?.trim();
  if (!raw) return 4;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 4;
  return Math.min(5, Math.max(1, n));
}

function replicateFluxProImageInput(prompt: string, seed?: number) {
  return {
    prompt,
    output_format: "png" as const,
    aspect_ratio: "4:5" as const,
    resolution: REPLICATE_FLUX_IMAGE_RESOLUTION,
    safety_tolerance: replicateFluxSafetyTolerance(),
    ...(typeof seed === "number" ? { seed } : {}),
  };
}

function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  // Keep seed within a positive 31-bit range.
  return Math.abs(hash) % 2_147_483_647;
}

function resolveBaseSeed(input: string): number {
  const envSeedRaw = process.env.REPLICATE_FLUX_SEED?.trim();
  if (envSeedRaw) {
    const parsed = parseInt(envSeedRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return hashStringToSeed(input);
}

function normalizeScenePromptForWardrobe(scenePrompt: string): string {
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

/** Builds appearance-lock suffix from optional parent-selected appearance. */
function buildAppearanceLockSuffix(
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

/** Retry OpenAI request with exponential backoff on rate limit (429). Respects retry-after header when present. */
async function createCompletionWithRetry(
  params: Parameters<typeof openai.chat.completions.create>[0],
  maxRetries = 5
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      const isRateLimit =
        err instanceof RateLimitError ||
        (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 429);
      if (!isRateLimit || attempt === maxRetries) throw err;

      let delayMs: number;
      if (err instanceof RateLimitError && err.headers) {
        const retryAfter = err.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          delayMs = !Number.isNaN(seconds) ? seconds * 1000 : 10000;
        } else {
          delayMs = Math.min(10000 * 2 ** attempt + Math.random() * 2000, 60000);
        }
      } else {
        delayMs = Math.min(10000 * 2 ** attempt + Math.random() * 2000, 60000);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** In-memory rate limit: max generate requests per user per rolling minute (cap from tier priorityWeight). */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(
  userId: string,
  maxPerWindow: number
): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= maxPerWindow) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required to create books." }, { status: 401 });
    }

    const userId = session.user.id as string;
    const userEmail = session.user.email ?? null;

    const supabaseReady = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    let familyPlan: FamilyPlanContext | null = null;
    if (supabaseReady) {
      await ensureUser(userId, userEmail);
      familyPlan = await resolveFamilyPlanContext(userId);
    }
    const tierForRateLimit = familyPlan?.featureTier ?? "free";
    const rateLimitMax = maxGenerateRequestsPerMinuteForTier(tierForRateLimit);
    const rateLimit = checkRateLimit(userId, rateLimitMax);
    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment before creating another book.",
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: rateLimit.retryAfter
            ? { "Retry-After": String(rateLimit.retryAfter) }
            : undefined,
        }
      );
    }

    const body = await request.json();
    const {
      updateBookId,
      childName,
      age,
      pronouns,
      interests,
      lifeLesson,
      artStyle,
      appearance,
      preferredVoice,
      dedication,
      regenReason,
      childProfileId,
      characterAppearanceDescription,
    } = body as {
      updateBookId?: string;
      appearance?: CharacterAppearance;
      preferredVoice?: string;
      dedication?: { message?: string; from?: string };
      regenReason?: string;
      childProfileId?: string;
      characterAppearanceDescription?: string;
    } & typeof body;

    const validation = validateCreatePayload(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (!childName || !interests?.length) {
      return NextResponse.json(
        { error: "Child name and interests are required." },
        { status: 400 }
      );
    }

    const childProfileIdRaw =
      typeof childProfileId === "string" ? childProfileId.trim() : "";
    const sessionCharDesc =
      typeof characterAppearanceDescription === "string"
        ? characterAppearanceDescription.trim().slice(0, 2500)
        : "";

    let loadedProfile: ChildProfile | null = null;
    if (childProfileIdRaw) {
      if (!supabaseReady) {
        return NextResponse.json(
          { error: "Child profiles require an account with storage enabled." },
          { status: 400 }
        );
      }
      loadedProfile = await getChildProfileById(userId, childProfileIdRaw);
      if (!loadedProfile) {
        return NextResponse.json({ error: "Child profile not found." }, { status: 404 });
      }
    }

    const fromProfileAppearance =
      loadedProfile?.appearance && typeof loadedProfile.appearance === "object"
        ? loadedProfile.appearance
        : {};
    const fromBodyAppearance =
      appearance && typeof appearance === "object" ? appearance : {};
    const mergedAppearance = { ...fromProfileAppearance, ...fromBodyAppearance };
    const effectiveAppearance: CharacterAppearance | undefined =
      Object.keys(mergedAppearance).length > 0
        ? (mergedAppearance as CharacterAppearance)
        : undefined;

    const profileCharDesc = loadedProfile?.appearanceDetailedDescription?.trim() ?? "";
    const parentCharacterLock = sessionCharDesc || profileCharDesc;

    const isCorrection = Boolean(updateBookId);
    if (supabaseReady && familyPlan) {
      const profile = await getUserProfile(userId);
      const tier = familyPlan.featureTier;
      const billingUserId = familyPlan.billingUserId;
      const allowedArtStyles = getTierCapabilities(tier).allowedArtStyles;
      if (
        typeof artStyle === "string" &&
        !allowedArtStyles.includes(artStyle as (typeof allowedArtStyles)[number])
      ) {
        return NextResponse.json(
          {
            error: "This art style is not included in your current plan.",
            allowedArtStyles,
          },
          { status: 403 }
        );
      }
      if (!profile?.parentConsentAt) {
        return NextResponse.json(
          { error: "Parental consent required. Please complete the consent flow before creating books." },
          { status: 403 }
        );
      }
      if (!isCorrection) {
        const { limit, period } = await getBookLimitForUser(billingUserId);
        const count = await getUserBookCountByPeriod(billingUserId, period);
        const effectiveLimit = count === 0 ? limit + 1 : limit;
        if (count >= effectiveLimit) {
          const periodMsg = period === "monthly" ? "this month" : "total";
          return NextResponse.json(
            { error: `You've reached your limit of ${limit} books ${periodMsg}. Upgrade your plan for more stories!` },
            { status: 403 }
          );
        }
      }
    }

    const lessonTier = familyPlan?.featureTier ?? "free";
    const lessonAccess = getTierCapabilities(lessonTier).lessonPackAccess;
    const rawLifeLesson =
      typeof lifeLesson === "string" && lifeLesson.trim()
        ? lifeLesson.trim()
        : "kindness";
    const lessonCheck = validateLifeLessonForAccess(rawLifeLesson, lessonAccess);
    if (!lessonCheck.ok) {
      return NextResponse.json({ error: lessonCheck.error }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "Replicate API token is not configured." },
        { status: 500 }
      );
    }

    // Content moderation: check user-provided input before generation
    const textToModerate = [
      childName,
      Array.isArray(interests) ? interests.join(" ") : "",
      lifeLesson || "",
      typeof regenReason === "string" ? regenReason : "",
      sessionCharDesc,
      profileCharDesc,
      typeof effectiveAppearance === "object" && effectiveAppearance
        ? JSON.stringify(effectiveAppearance)
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (textToModerate) {
      try {
        const mod = await openai.moderations.create({
          input: textToModerate,
          model: "text-moderation-latest",
        });
        const result = mod.results?.[0];
        if (result?.flagged) {
          return NextResponse.json(
            { error: "Your input could not be processed. Please adjust and try again." },
            { status: 400 }
          );
        }
      } catch (modErr) {
        console.warn("[KiddoTales] Moderation check failed, proceeding:", modErr);
      }
    }

    // 1. Generate story with GPT-4o
    const trimmedRegenReason =
      typeof regenReason === "string" ? regenReason.trim().slice(0, 300) : "";
    const baseUserPrompt = getStoryUserPrompt({
      childName,
      age: age || 5,
      pronouns: pronouns || "",
      interests,
      lifeLesson: lifeLesson || "kindness",
      artStyle: artStyle || "whimsical-watercolor",
      appearance: effectiveAppearance,
    });
    const visualAnchor =
      parentCharacterLock.length > 2200
        ? `${parentCharacterLock.slice(0, 2200)}…`
        : parentCharacterLock;
    const visualAnchorBlock = visualAnchor
      ? `\n\nParent-provided visual reference for the main character (keep JSON characterDescription aligned with this look; authoritative for illustrations): ${visualAnchor}`
      : "";
    const userPromptBase = `${baseUserPrompt}${visualAnchorBlock}`;
    const userPrompt = trimmedRegenReason
      ? `${userPromptBase}\n\nParent feedback for this regeneration (highest priority to address while keeping the story cozy and age-appropriate): ${trimmedRegenReason}`
      : userPromptBase;

    const systemPrompt = STORY_SYSTEM_PROMPT
      .replace("[AGE]", String(age || 5))
      .replace("[PRONOUNS]", pronouns || "they/them")
      .replace("[NAME]", childName)
      .replace("[INTERESTS]", interests?.join(", ") || "")
      .replace("[LESSON]", lifeLesson || "kindness");
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];
    const createParams = {
      messages,
      response_format: { type: "json_object" as const },
      temperature: 0.8,
      max_tokens: 4096,
    };

    let completion;
    try {
      console.log("[KiddoTales] Calling OpenAI...");
      completion = await createCompletionWithRetry({
        ...createParams,
        model: "gpt-4o-2024-11-20",
      });
      console.log("[KiddoTales] OpenAI success");
    } catch (gpt4oErr) {
      console.error("[KiddoTales] OpenAI error:", {
        name: gpt4oErr instanceof Error ? gpt4oErr.constructor?.name : "unknown",
        message: gpt4oErr instanceof Error ? gpt4oErr.message : String(gpt4oErr),
        status: gpt4oErr && typeof gpt4oErr === "object" && "status" in gpt4oErr ? (gpt4oErr as { status: number }).status : undefined,
      });
      const isRateLimit =
        gpt4oErr instanceof RateLimitError ||
        (gpt4oErr && typeof gpt4oErr === "object" && "status" in gpt4oErr && (gpt4oErr as { status: number }).status === 429);
      if (isRateLimit) {
        try {
          completion = await openai.chat.completions.create({
            ...createParams,
            model: "gpt-4o-mini",
          });
        } catch {
          throw gpt4oErr;
        }
      } else {
        throw gpt4oErr;
      }
    }

    const content = completion && "choices" in completion ? completion.choices[0]?.message?.content : undefined;
    if (!content) {
      throw new Error("No story content from OpenAI");
    }

    let parsed: {
      title: string;
      pages: BookPage[];
      coverImagePrompt?: string;
      characterDescription?: string;
      secondaryCharacterDescription?: string | null;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = JSON.parse(match ? match[1] : content);
    }

    if (!parsed.pages || !Array.isArray(parsed.pages) || parsed.pages.length !== 8) {
      throw new Error("Invalid story structure from OpenAI");
    }

    const styleSuffix = getArtStylePrompt(artStyle);
    const isPhotoRealistic = artStyle === "photo-realistic";

    // Character consistency: prepend same description to every image prompt
    // Parent-selected appearance overrides GPT's characterDescription when provided
    const appearanceLockSuffix = buildAppearanceLockSuffix(
      pronouns || "",
      effectiveAppearance
    );
    const isGirl = /she\/her|girl/i.test(pronouns || "");
    const isBoy = /he\/him|boy/i.test(pronouns || "");
    const genderPhrase = isGirl ? "young girl" : isBoy ? "young boy" : "young child";
    const normalizedAge = Math.min(12, Math.max(1, Number(age || 5)));
    const ageScaleLockSuffix =
      normalizedAge >= 10
        ? ` Age lock: depict the child with clearly ${normalizedAge}-year-old preteen proportions, height, and limb length; do not make the child look younger.`
        : ` Age lock: depict the child with clearly ${normalizedAge}-year-old child proportions, height, and limb length appropriate for that exact age.`;
    let characterPrefix =
      (parentCharacterLock && parentCharacterLock.trim()) ||
      parsed.characterDescription?.trim() ||
      `A ${age || 5}-year-old ${genderPhrase} named ${childName}, human ears, no animal features, wearing the exact same outfit in every image: a pastel top, denim bottoms, white socks, and sneakers.`;

    if (appearanceLockSuffix) {
      characterPrefix = `${characterPrefix} ${appearanceLockSuffix}`;
    }
    characterPrefix = `${characterPrefix}${ageScaleLockSuffix}`;

    if (isPhotoRealistic) {
      characterPrefix =
        characterPrefix +
        " Realistic skin texture, natural skin tones, lifelike hair detail, soft diffused natural lighting on face, photorealistic child portrait quality.";
    }

    const wardrobeLockSuffix =
      " Wardrobe lock: the child must keep the exact same clothing, colors, layers, footwear, and accessories in the cover and every page. No outfit changes.";
    const wardrobeReminder = " Use the exact same locked outfit for the child in this scene.";

    const secondaryChar =
      parsed.secondaryCharacterDescription?.trim() || null;
    const effectiveSecondaryChar =
      isPhotoRealistic && secondaryChar
        ? secondaryChar +
          ". Photorealistic texture, natural lighting, lifelike rendering, highly detailed and realistic"
        : secondaryChar;

    // 2. Generate cover image first, then page images (throttled: free tier = 6 req/min)
    console.log("[KiddoTales] OpenAI done, starting Replicate (cover + 8 images, throttled)...");
    let coverImageUrl = "";

    const antiHybridSuffix =
      " The main character is a human child with human ears, human hair, and no horn, no tail, no hooves, no animal features.";
    const imageSafetySuffix = isPhotoRealistic
      ? " Fully clothed child, age-appropriate outfit, G-rated family-safe scene."
      : " Wholesome children's picture book illustration, G-rated family audience. Characters in normal modest everyday outfits; cheerful innocent scenes and poses suited to ages 3–8; bright friendly classic storybook mood.";
    const photoRealNegativeSuffix =
      " No illustration, no cartoon, no anime, no 3D render, no painting, no doll-like face, no oversized eyes, no plastic skin, no fantasy art style.";
    const photoRealStyleLock =
      " Ultra-photorealistic cinematic photograph, 35mm lens, natural skin texture, realistic hair strands, accurate child proportions, physically realistic lighting, shallow depth of field, high dynamic range, subtle film grain, color-true daylight.";
    const bookSeedBase = resolveBaseSeed(
      [childName, String(age || 5), pronouns || "", parsed.title || "", lifeLesson || ""].join("|")
    );
    const coverPrompt =
      parsed.coverImagePrompt ||
      `${parsed.title}. ${(parsed.pages[0]?.illustrationPromptBase ?? parsed.pages[0]?.imagePrompt ?? "")}. Magical storybook cover that captures the whole story.`;
    const normalizedCoverPrompt = `${normalizeScenePromptForWardrobe(coverPrompt)}${wardrobeReminder}`;
    const fullCoverPrompt = effectiveSecondaryChar
      ? isPhotoRealistic
        ? `Character lock: ${characterPrefix}${wardrobeLockSuffix} Style lock: ${photoRealStyleLock} ${styleSuffix}. Scene: The child and creature are two separate beings. ${effectiveSecondaryChar}. ${normalizedCoverPrompt}. ${antiHybridSuffix}${imageSafetySuffix}${photoRealNegativeSuffix}`
        : `${characterPrefix}${wardrobeLockSuffix}. The child and creature are two separate beings. ${effectiveSecondaryChar}. ${normalizedCoverPrompt}. ${styleSuffix}. ${antiHybridSuffix}${imageSafetySuffix}`
      : isPhotoRealistic
        ? `Character lock: ${characterPrefix}${wardrobeLockSuffix} Style lock: ${photoRealStyleLock} ${styleSuffix}. Scene: ${normalizedCoverPrompt}. ${antiHybridSuffix}${imageSafetySuffix}${photoRealNegativeSuffix}`
        : `${characterPrefix}${wardrobeLockSuffix}. ${normalizedCoverPrompt}. ${styleSuffix}. ${antiHybridSuffix}${imageSafetySuffix}`;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const output = await replicate.run(REPLICATE_FLUX_IMAGE_MODEL, {
          input: replicateFluxProImageInput(fullCoverPrompt, bookSeedBase),
        });
        const result = Array.isArray(output) ? output[0] : output;
        if (result && typeof result === "object" && "url" in result && typeof (result as { url: () => string }).url === "function") {
          coverImageUrl = (result as { url: () => string }).url();
        } else if (typeof result === "string") {
          coverImageUrl = result;
        }
        break;
      } catch (repErr) {
        const repStatus = repErr && typeof repErr === "object" && "status" in repErr ? (repErr as { status: number }).status : undefined;
        if (repStatus === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 35000));
        } else {
          console.warn("[KiddoTales] Cover image failed, continuing without:", repErr);
          break;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 10000)); // Throttle before page images

    const imageUrls: string[] = [];
    for (let i = 0; i < parsed.pages.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 10000)); // 6 per minute throttle limit on replicate.
      }
      const page = parsed.pages[i];
      const rawPromptText = page.illustrationPromptBase ?? page.imagePrompt ?? "";
      const normalizedPromptText = normalizeScenePromptForWardrobe(rawPromptText);
      const promptText = `${normalizedPromptText}${wardrobeReminder}`;
      const includeSecondary =
        effectiveSecondaryChar && page.secondaryCharacterInScene === true;
      const scenePart = includeSecondary
        ? isPhotoRealistic
          ? `Character lock: ${characterPrefix}${wardrobeLockSuffix} Style lock: ${photoRealStyleLock} ${styleSuffix}. Scene: The child and creature are two separate beings. ${effectiveSecondaryChar}. ${promptText}.`
          : `${characterPrefix}${wardrobeLockSuffix}. The child and creature are two separate beings. ${effectiveSecondaryChar}. ${promptText}. ${styleSuffix}`
        : isPhotoRealistic
          ? `Character lock: ${characterPrefix}${wardrobeLockSuffix} Style lock: ${photoRealStyleLock} ${styleSuffix}. Scene: ${promptText}.`
          : `${characterPrefix}${wardrobeLockSuffix}. ${promptText}. ${styleSuffix}`;
      const fullPrompt = isPhotoRealistic
        ? `${scenePart} ${antiHybridSuffix}${imageSafetySuffix}${photoRealNegativeSuffix}`
        : `${scenePart}. ${antiHybridSuffix}${imageSafetySuffix}`;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const output = await replicate.run(REPLICATE_FLUX_IMAGE_MODEL, {
            input: replicateFluxProImageInput(fullPrompt, bookSeedBase + i + 1),
          });
          const result = Array.isArray(output) ? output[0] : output;
          if (result && typeof result === "object" && "url" in result && typeof (result as { url: () => string }).url === "function") {
            imageUrls.push((result as { url: () => string }).url());
          } else if (typeof result === "string") {
            imageUrls.push(result);
          } else {
            imageUrls.push("");
          }
          break;
        } catch (repErr) {
          const repStatus = repErr && typeof repErr === "object" && "status" in repErr ? (repErr as { status: number }).status : undefined;
          console.error(`[KiddoTales] Replicate error (page ${i + 1}, attempt ${attempt + 1}):`, {
            name: repErr instanceof Error ? repErr.constructor?.name : "unknown",
            message: repErr instanceof Error ? repErr.message : String(repErr),
            status: repStatus,
          });
          if (repStatus === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 35000));
          } else {
            throw repErr;
          }
        }
      }
    }

    const dedicationData =
      dedication &&
      typeof dedication === "object" &&
      (dedication.message?.trim() || dedication.from?.trim())
        ? {
            message: (dedication.message ?? "").trim().slice(0, 200),
            from: (dedication.from ?? "").trim().slice(0, 80),
          }
        : undefined;

    const createdAt = new Date().toISOString();
    let book: BookData = {
      title: parsed.title,
      pages: parsed.pages.map((p: BookPage, i: number) => ({
        ...p,
        imageUrl: imageUrls[i] || undefined,
      })),
      createdAt,
      dedication: dedicationData,
      coverImageUrl: coverImageUrl || undefined,
    };

    const hasSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasSupabase) {
      try {
        if (!familyPlan) familyPlan = await resolveFamilyPlanContext(userId);
        const billingUserId = familyPlan.billingUserId;
        const featureTier = familyPlan.featureTier;
        const { period } = await getBookLimitForUser(billingUserId);
        const bookId = updateBookId ?? crypto.randomUUID();
        const storagePath = (name: string) => `books/${bookId}/${name}`;

        let coverStorageUrl = book.coverImageUrl ?? null;
        if (book.coverImageUrl) {
          coverStorageUrl = await uploadImageToStorage(
            book.coverImageUrl,
            storagePath("cover.png")
          );
        }

        const pagesWithStorage = await Promise.all(
          book.pages.map(async (p, i) => {
            const url = p.imageUrl;
            if (!url) return { ...p };
            const storageUrl = await uploadImageToStorage(
              url,
              storagePath(`page-${i}.png`)
            );
            return { ...p, imageUrl: storageUrl ?? url };
          })
        );

        book = {
          ...book,
          id: bookId,
          coverImageUrl: coverStorageUrl ?? book.coverImageUrl,
          pages: pagesWithStorage,
        };

        const savedBook = {
          ...book,
          coverImageData: undefined,
          pages: book.pages.map(({ imageData: _, ...p }) => p),
        };
        const creationMetadata = {
          childName,
          age: age || 5,
          pronouns: pronouns || "they/them",
          interests: interests || [],
          lifeLesson: lifeLesson || "kindness",
          artStyle: artStyle || "whimsical-watercolor",
          appearance: effectiveAppearance || appearance || {},
          preferredVoice: preferredVoice && preferredVoice !== "none" ? preferredVoice : "none",
          dedication: dedicationData ?? undefined,
          childProfileId: childProfileIdRaw || undefined,
          characterAppearanceDescription: sessionCharDesc || undefined,
        };

        const subscriptionTierAtCreation = featureTier;

        if (updateBookId) {
          await replaceBook(bookId, userId, savedBook, creationMetadata);
        } else {
          await saveBookToSupabase(
            userId,
            savedBook,
            bookId,
            creationMetadata,
            subscriptionTierAtCreation
          );
        }

        await insertBookUsageEvent(userId, bookId, billingUserId);

        book = { ...book, creationMetadata };

        // Generate AI voice for all 8 interior pages when user selected an AI voice
        const wantsAiVoice =
          preferredVoice &&
          preferredVoice !== "none" &&
          process.env.OPENAI_API_KEY;
        if (wantsAiVoice) {
          console.log("[KiddoTales] Starting AI voice generation, preferredVoice:", preferredVoice);
          try {
            if (featureTier === "free") {
              console.log("[KiddoTales] Skipping AI voice: user tier is free");
            } else {
              const voiceLimit = getVoiceLimitForTier(featureTier);
              const allowedVoices = getVoicesForTier(featureTier);
              const voice = allowedVoices.includes(preferredVoice)
                ? preferredVoice
                : allowedVoices[0] ?? TTS_DEFAULT_VOICE;
              const { period } = await getBookLimitForUser(billingUserId);
              const voiceCount = await getUserVoiceCountByPeriod(billingUserId, period);
              const alreadyUsed = await hasBookUsedVoiceSlot(bookId);

              if (!alreadyUsed && voiceCount >= voiceLimit) {
                console.log("[KiddoTales] Skipping AI voice: limit reached", {
                  voiceCount,
                  voiceLimit,
                  period,
                });
              } else {
                const pagePromises = book.pages.map(
                  async (page, pageIndex) => {
                    const text = page?.text?.trim();
                    if (!text) return null;
                    try {
                      const response = await openai.audio.speech.create({
                        model: "tts-1",
                        voice: voice as "alloy" | "ash" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer",
                        input: text.slice(0, 4096),
                      });
                      const arrayBuffer = await response.arrayBuffer();
                      const buffer = Buffer.from(arrayBuffer);
                      const path = `books/${bookId}/audio/page-${pageIndex}.mp3`;
                      const audioUrl = await uploadAudioToStorage(buffer, path);
                      if (!audioUrl) {
                        console.error("[KiddoTales] Audio upload failed for page", pageIndex);
                        return null;
                      }
                      return { pageIndex, audioUrl, audioVoice: voice };
                    } catch (err) {
                      console.error("[KiddoTales] TTS failed for page", pageIndex, err);
                      return null;
                    }
                  }
                );
                const results = await Promise.all(pagePromises);
                const updates = results.filter(
                  (r): r is { pageIndex: number; audioUrl: string; audioVoice: string } =>
                    r !== null
                );

                if (updates.length > 0) {
                  const updated = await updateBookPagesWithAudio(bookId, userId, updates);
                  if (!updated) {
                    console.error("[KiddoTales] updateBookPagesWithAudio failed - audio files uploaded but DB not updated");
                  } else if (!alreadyUsed) {
                    await insertVoiceUsageEvent(userId, bookId, billingUserId);
                  }
                  // Always merge into response so client gets audio (files are in storage)
                  book = {
                    ...book,
                    pages: book.pages.map((p, i) => {
                      const u = updates.find((x) => x.pageIndex === i);
                      return u ? { ...p, audioUrl: u.audioUrl, audioVoice: u.audioVoice } : p;
                    }),
                  };
                  console.log("[KiddoTales] AI voice generated for", updates.length, "pages");
                } else {
                  console.error("[KiddoTales] No audio updates produced (all pages failed?)");
                }
              }
            }
          } catch (voiceErr) {
            console.error("[KiddoTales] AI voice generation error:", voiceErr);
            // Don't fail the whole creation; book is saved, voice can be generated later
          }
        }
      } catch (dbErr) {
        console.error("[KiddoTales] Supabase save error:", dbErr);
      }
    }

    return NextResponse.json(book);
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    const is429 = status === 429;
    const likelyReplicate = is429 && (message.toLowerCase().includes("throttl") || message.toLowerCase().includes("rate"));
    const userMessage = is429
      ? likelyReplicate
        ? "Replicate rate limit. Images are throttled on free tier (6/min). Try again in a minute or add a payment method."
        : "OpenAI rate limit. Please wait a minute and try again."
      : message;
    console.error("Generate error:", { status, message, fullError: err });
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
