import { NextRequest, NextResponse } from "next/server";
import OpenAI, { RateLimitError } from "openai";
import Replicate from "replicate";
import {
  getStoryUserPrompt,
  ART_STYLE_PROMPTS,
} from "@/lib/constants";
import type { BookData, BookPage, CharacterAppearance } from "@/types";
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
} from "@/lib/db";
import {
  getVoiceLimitForTier,
  getVoicesForTier,
  TTS_DEFAULT_VOICE,
} from "@/lib/stripe";
import { uploadImageToStorage, uploadAudioToStorage } from "@/lib/supabase-storage";
import { validateCreatePayload } from "@/lib/validation";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/** Builds character description from optional parent-selected appearance. */
function buildAppearancePrefix(
  childName: string,
  age: number,
  pronouns: string,
  appearance?: CharacterAppearance
): string | null {
  if (!appearance || typeof appearance !== "object") return null;
  const a = appearance as Record<string, unknown>;
  const hasAny =
    a.hairColor || a.hairStyle || a.skinTone || a.eyeColor || a.glasses || a.freckles;
  if (!hasAny) return null;

  const isGirl = /she\/her|girl/i.test(pronouns || "");
  const isBoy = /he\/him|boy/i.test(pronouns || "");
  const genderPhrase = isGirl ? "young girl" : isBoy ? "young boy" : "young child";
  const parts: string[] = [`A ${age}-year-old ${genderPhrase} named ${childName}`];

  const hair: string[] = [];
  if (a.hairColor && typeof a.hairColor === "string") hair.push(a.hairColor);
  if (a.hairStyle && typeof a.hairStyle === "string") hair.push(a.hairStyle);
  if (hair.length) parts.push(`${hair.join(" ")} hair`);

  if (a.skinTone && typeof a.skinTone === "string") parts.push(`${a.skinTone} skin`);
  if (a.eyeColor && typeof a.eyeColor === "string") parts.push(`${a.eyeColor} eyes`);
  if (a.glasses) parts.push("wearing glasses");
  if (a.freckles) parts.push("freckles");

  return parts.join(", ") + ", human ears, no animal features, children's book illustration style.";
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

/** In-memory rate limit: max 5 generate requests per user per minute. */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number } {
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
  if (entry.count >= RATE_LIMIT_MAX) {
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

    const rateLimit = checkRateLimit(userId);
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
    } = body as { updateBookId?: string; appearance?: CharacterAppearance; preferredVoice?: string; dedication?: { message?: string; from?: string } } & typeof body;

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

    const isCorrection = Boolean(updateBookId);
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await ensureUser(userId, userEmail);
      const profile = await getUserProfile(userId);
      if (!profile?.parentConsentAt) {
        return NextResponse.json(
          { error: "Parental consent required. Please complete the consent flow before creating books." },
          { status: 403 }
        );
      }
      if (!isCorrection) {
        const { limit, period } = await getBookLimitForUser(userId);
        const count = await getUserBookCountByPeriod(userId, period);
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
      typeof appearance === "object" && appearance
        ? JSON.stringify(appearance)
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
    const userPrompt = getStoryUserPrompt({
      childName,
      age: age || 5,
      pronouns: pronouns || "",
      interests,
      lifeLesson: lifeLesson || "kindness",
      artStyle: artStyle || "whimsical-watercolor",
      appearance,
    });

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

    const styleSuffix = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS["whimsical-watercolor"];
    const isPhotoRealistic = artStyle === "photo-realistic";

    // Character consistency: prepend same description to every image prompt
    // Parent-selected appearance overrides GPT's characterDescription when provided
    const appearancePrefix = buildAppearancePrefix(
      childName,
      age || 5,
      pronouns || "",
      appearance
    );
    const isGirl = /she\/her|girl/i.test(pronouns || "");
    const isBoy = /he\/him|boy/i.test(pronouns || "");
    const genderPhrase = isGirl ? "young girl" : isBoy ? "young boy" : "young child";
    let characterPrefix =
      appearancePrefix ||
      parsed.characterDescription?.trim() ||
      `A ${age || 5}-year-old ${genderPhrase} named ${childName}, children's book illustration style.`;

    if (isPhotoRealistic) {
      characterPrefix =
        characterPrefix.replace(/,\s*children's book illustration style\.?$/i, "") +
        ". Realistic skin texture, natural skin tones, lifelike hair detail, soft diffused natural lighting on face, photorealistic child portrait quality";
    }

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
    const coverPrompt =
      parsed.coverImagePrompt ||
      `${parsed.title}. ${(parsed.pages[0]?.illustrationPromptBase ?? parsed.pages[0]?.imagePrompt ?? "")}. Magical storybook cover that captures the whole story.`;
    const fullCoverPrompt = effectiveSecondaryChar
      ? `${characterPrefix}. The child and creature are two separate beings. ${effectiveSecondaryChar}. ${coverPrompt}. ${styleSuffix}. ${antiHybridSuffix}`
      : `${characterPrefix}. ${coverPrompt}. ${styleSuffix}. ${antiHybridSuffix}`;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const output = await replicate.run(
          "black-forest-labs/flux-2-dev" as `${string}/${string}`,
          { input: { prompt: fullCoverPrompt, output_format: "png", aspect_ratio: "4:5" } }
        );
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
      const promptText = page.illustrationPromptBase ?? page.imagePrompt ?? "";
      const includeSecondary =
        effectiveSecondaryChar && page.secondaryCharacterInScene === true;
      const scenePart = includeSecondary
        ? `${characterPrefix}. The child and creature are two separate beings. ${effectiveSecondaryChar}. ${promptText}. ${styleSuffix}`
        : `${characterPrefix}. ${promptText}. ${styleSuffix}`;
      const fullPrompt = `${scenePart}. ${antiHybridSuffix}`;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const output = await replicate.run(
            "black-forest-labs/flux-2-dev" as `${string}/${string}`,
            { input: { prompt: fullPrompt, output_format: "png", aspect_ratio: "4:5" } }
          );
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
        const { period } = await getBookLimitForUser(userId);
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
          appearance: appearance || {},
          preferredVoice: preferredVoice && preferredVoice !== "none" ? preferredVoice : "none",
          dedication: dedicationData ?? undefined,
        };

        const profile = await getUserProfile(userId);
        const subscriptionTierAtCreation = profile?.subscriptionTier ?? "free";

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

        await insertBookUsageEvent(userId, bookId);

        book = { ...book, creationMetadata };

        // Generate AI voice for all 8 interior pages when user selected an AI voice
        const wantsAiVoice =
          preferredVoice &&
          preferredVoice !== "none" &&
          process.env.OPENAI_API_KEY;
        if (wantsAiVoice) {
          console.log("[KiddoTales] Starting AI voice generation, preferredVoice:", preferredVoice);
          try {
            const profile = await getUserProfile(userId);
            const tier = profile?.subscriptionTier ?? "free";
            if (tier === "free") {
              console.log("[KiddoTales] Skipping AI voice: user tier is free");
            } else {
              const voiceLimit = getVoiceLimitForTier(tier);
              const allowedVoices = getVoicesForTier(tier);
              const voice = allowedVoices.includes(preferredVoice)
                ? preferredVoice
                : allowedVoices[0] ?? TTS_DEFAULT_VOICE;
              const { period } = await getBookLimitForUser(userId);
              const voiceCount = await getUserVoiceCountByPeriod(userId, period);
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
                    await insertVoiceUsageEvent(userId, bookId);
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
