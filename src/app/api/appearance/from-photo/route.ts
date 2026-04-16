import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { ensureUser, getUserProfile } from "@/lib/db";
import { getTierCapabilities } from "@/lib/entitlements";
import { resolveFamilyPlanContext } from "@/lib/family-sharing";
import { sanitizePhotoAnalysisJson } from "@/lib/appearance-from-photo";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const photoRateMap = new Map<string, { count: number; resetAt: number }>();
const PHOTO_WINDOW_MS = 60_000;
const PHOTO_MAX_PER_WINDOW = 8;

function checkPhotoRateLimit(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = photoRateMap.get(userId);
  if (!entry) {
    photoRateMap.set(userId, { count: 1, resetAt: now + PHOTO_WINDOW_MS });
    return { ok: true };
  }
  if (now >= entry.resetAt) {
    photoRateMap.set(userId, { count: 1, resetAt: now + PHOTO_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= PHOTO_MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

const VISION_SYSTEM = `You analyze a single reference photo of a child for a parent-created children's storybook.
Return ONLY valid JSON with this exact shape (no markdown):
{
  "appearance": {
    "hairColor": "one of: blonde, brown, black, red, auburn or omit key if unclear",
    "hairStyle": "one of: short, long, curly, straight, pigtails, braids, ponytail or omit",
    "skinTone": "one of: light, medium, tan, brown, dark or omit",
    "eyeColor": "one of: blue, brown, green, hazel or omit",
    "glasses": true/false,
    "freckles": true/false
  },
  "detailedCharacterDescription": "4-7 sentences, maximum detail, STRICTLY shoulders-up only. Describe only head/face/neck-visible traits: head shape, face shape, forehead, eyebrows, eye shape and spacing, eyelashes, nose shape, lips/smile, cheeks, chin/jawline, ear visibility, freckles/moles if visible, hairline/part/texture/length around face, skin tone nuance, glasses details if present, and overall expression. Exclude clothing details entirely. Do not mention shirt, jacket, colors of clothes, neckline, fabric, or accessories below the neck. No name. No diagnosis. G-rated. Suitable to prepend to every illustration prompt.",
  "confidence": "high" | "medium" | "low",
  "warnings": ["optional short notes e.g. face partially obscured"]
}
Rules: Never guess medical conditions. If the face is not visible or photo is not a child, set confidence low and explain in warnings. Focus on facial identity cues. Do not include any text outside the JSON.`;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const rl = checkPhotoRateLimit(userId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many photo uploads. Please wait a moment.", retryAfter: rl.retryAfter },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI is not configured." }, { status: 500 });
    }

    const supabaseReady = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    if (!supabaseReady) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
    }

    await ensureUser(userId, session.user.email ?? undefined);
    const [userRow, plan] = await Promise.all([
      getUserProfile(userId),
      resolveFamilyPlanContext(userId),
    ]);
    if (!userRow?.parentConsentAt) {
      return NextResponse.json(
        { error: "Parental consent is required before uploading a child photo." },
        { status: 403 }
      );
    }

    const tier = plan.featureTier;
    if (!getTierCapabilities(tier).photoAppearanceImport) {
      return NextResponse.json(
        { error: "Photo character import is available on Magic and Legend plans." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing photo file (field name: photo)." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo must be 5 MB or smaller." }, { status: 400 });
    }
    const mime = (file.type || "application/octet-stream").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Photo must be JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20",
      max_tokens: 1200,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISION_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this reference photo for children's book illustration consistency. The image is uploaded by a parent for appearance reference only.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "No analysis returned." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid model response." }, { status: 502 });
    }

    const sanitized = sanitizePhotoAnalysisJson(parsed);
    if (!sanitized) {
      return NextResponse.json({ error: "Could not parse appearance analysis." }, { status: 502 });
    }

    try {
      const mod = await openai.moderations.create({
        input: sanitized.detailedCharacterDescription,
        model: "text-moderation-latest",
      });
      if (mod.results?.[0]?.flagged) {
        return NextResponse.json(
          { error: "This photo could not be processed. Try a different image." },
          { status: 400 }
        );
      }
    } catch {
      // proceed if moderation API fails
    }

    return NextResponse.json({
      ...sanitized,
      photoStored: false,
    });
  } catch (e) {
    console.error("POST /api/appearance/from-photo:", e);
    const message = e instanceof Error ? e.message : "Failed to analyze photo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
