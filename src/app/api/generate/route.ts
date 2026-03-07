import { NextRequest, NextResponse } from "next/server";
import OpenAI, { RateLimitError } from "openai";
import Replicate from "replicate";
import {
  getStoryUserPrompt,
  ART_STYLE_PROMPTS,
} from "@/lib/constants";
import type { BookData, BookPage } from "@/types";
import { STORY_SYSTEM_PROMPT } from "@/lib/prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      childName,
      age,
      pronouns,
      interests,
      lifeLesson,
      artStyle,
    } = body;

    if (!childName || !interests?.length) {
      return NextResponse.json(
        { error: "Child name and interests are required." },
        { status: 400 }
      );
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

    // 1. Generate story with GPT-4o
    const userPrompt = getStoryUserPrompt({
      childName,
      age: age || 5,
      pronouns: pronouns || "",
      interests,
      lifeLesson: lifeLesson || "kindness",
      artStyle: artStyle || "whimsical-watercolor",
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

    let parsed: { title: string; pages: BookPage[]; coverImagePrompt?: string; characterDescription?: string };
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

    // Character consistency: prepend same description to every image prompt
    const isGirl = /she\/her|girl/i.test(pronouns || "");
    const isBoy = /he\/him|boy/i.test(pronouns || "");
    const genderPhrase = isGirl ? "young girl" : isBoy ? "young boy" : "young child";
    const characterPrefix =
      parsed.characterDescription?.trim() ||
      `A ${age || 5}-year-old ${genderPhrase} named ${childName}, children's book illustration style.`;

    // 2. Generate cover image first, then page images (throttled: free tier = 6 req/min)
    console.log("[KiddoTales] OpenAI done, starting Replicate (cover + 8 images, throttled)...");
    let coverImageUrl = "";

    const coverPrompt =
      parsed.coverImagePrompt ||
      `${parsed.title}. ${(parsed.pages[0]?.illustrationPromptBase ?? parsed.pages[0]?.imagePrompt ?? "")}. Magical storybook cover that captures the whole story.`;
    const fullCoverPrompt = `${characterPrefix}. ${coverPrompt}. ${styleSuffix}`;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const output = await replicate.run(
          "black-forest-labs/flux-schnell" as `${string}/${string}`,
          { input: { prompt: fullCoverPrompt, num_outputs: 1, output_format: "png" } }
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
      const fullPrompt = `${characterPrefix}. ${promptText}. ${styleSuffix}`;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const output = await replicate.run(
            "black-forest-labs/flux-schnell" as `${string}/${string}`,
            { input: { prompt: fullPrompt, num_outputs: 1, output_format: "png" } }
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

    const book: BookData = {
      title: parsed.title,
      pages: parsed.pages.map((p: BookPage, i: number) => ({
        ...p,
        imageUrl: imageUrls[i] || undefined,
      })),
      createdAt: new Date().toISOString(),
      coverImageUrl: coverImageUrl || undefined,
    };

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
