import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBookById,
  updateBookPages,
  updateBookForNameCorrection,
  getBookLimitForUser,
  getUserBookCountByPeriod,
} from "@/lib/db";
import { ART_STYLE_PROMPTS } from "@/lib/constants";
import { uploadImageToStorage } from "@/lib/supabase-storage";
import Replicate from "replicate";
import { getTierCapabilities } from "@/lib/entitlements";
import { resolveFamilyPlanContext } from "@/lib/family-sharing";
import type { CreationMetadata, CharacterAppearance } from "@/types";

/** Compare form data with metadata. Returns true if only childName changed. */
function isNameOnlyChange(
  meta: CreationMetadata | undefined,
  corrected: CreationMetadata
): boolean {
  if (!meta) return false;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  if (!same(meta.age, corrected.age)) return false;
  if (!same(meta.pronouns, corrected.pronouns)) return false;
  if (!same(meta.interests, corrected.interests)) return false;
  if (!same(meta.lifeLesson, corrected.lifeLesson)) return false;
  if (!same(meta.artStyle, corrected.artStyle)) return false;
  if (!same(meta.appearance ?? {}, corrected.appearance ?? {})) return false;
  if (!same(meta.dedication ?? null, corrected.dedication ?? null)) return false;
  return meta.childName !== corrected.childName;
}

/** Replace old name with new name in text (case-insensitive). */
function replaceNameInText(text: string, oldName: string, newName: string): string {
  if (!oldName || !newName || oldName === newName) return text;
  const oldRe = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, "gi");
  return text.replace(oldRe, (m) =>
    m[0] === m[0].toUpperCase()
      ? newName[0]?.toUpperCase() + newName.slice(1)
      : newName.toLowerCase()
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REPLICATE_FLUX_IMAGE_MODEL =
  "black-forest-labs/flux-2-pro" as `${string}/${string}`;

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

  return (
    parts.join(", ") +
    ", human ears, no animal features, modest age-appropriate fully clothed outfit, children's book illustration style."
  );
}

type CorrectionMode = "full-regenerate" | "single-page";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await resolveFamilyPlanContext(session.user.id);
  const tier = plan.featureTier;
  const tierCapabilities = getTierCapabilities(tier);
  if (tier === "free" || tierCapabilities.correctionMode === "none") {
    return NextResponse.json(
      { error: "Upgrade your plan to correct books." },
      { status: 403 }
    );
  }

  const { id: bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "Book ID required" }, { status: 400 });
  }

  const book = await getBookById(bookId, session.user.id);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    childName,
    age,
    pronouns,
    interests,
    lifeLesson,
    artStyle,
    appearance,
    correctionMode,
    pageIndex,
    regenReason,
  } = body as {
    childName?: string;
    age?: number;
    pronouns?: string;
    interests?: string[];
    lifeLesson?: string;
    artStyle?: string;
    appearance?: CharacterAppearance;
    correctionMode?: CorrectionMode;
    pageIndex?: number;
    regenReason?: string;
  };
  const trimmedRegenReason =
    typeof regenReason === "string" ? regenReason.trim().slice(0, 300) : "";

  if (!childName?.trim()) {
    return NextResponse.json(
      { error: "Child name is required." },
      { status: 400 }
    );
  }

  const meta = book.creationMetadata;
  const corrected: CreationMetadata = {
    childName: childName.trim(),
    age: age ?? meta?.age ?? 5,
    pronouns: pronouns ?? meta?.pronouns ?? "they/them",
    interests: interests ?? meta?.interests ?? [],
    lifeLesson: lifeLesson ?? meta?.lifeLesson ?? "kindness",
    artStyle: artStyle ?? meta?.artStyle ?? "whimsical-watercolor",
    appearance: appearance ?? meta?.appearance ?? {},
    dedication: meta?.dedication,
    preferredVoice: meta?.preferredVoice,
  };

  const nameOnly = isNameOnlyChange(meta, corrected);
  const requestedMode: CorrectionMode = correctionMode ?? "full-regenerate";

  if (requestedMode === "single-page") {
    if (tierCapabilities.correctionMode !== "single-page") {
      return NextResponse.json(
        { error: "Single-page regeneration is available on Magic and Legend plans." },
        { status: 403 }
      );
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "Image generation is not configured." },
        { status: 500 }
      );
    }
    if (typeof pageIndex !== "number" || !Number.isInteger(pageIndex)) {
      return NextResponse.json({ error: "A valid page index is required." }, { status: 400 });
    }
    if (pageIndex < 0 || pageIndex >= book.pages.length) {
      return NextResponse.json({ error: "Page index is out of range." }, { status: 400 });
    }

    const target = book.pages[pageIndex];
    const effectiveArtStyle = corrected.artStyle || "whimsical-watercolor";
    const styleSuffix = ART_STYLE_PROMPTS[effectiveArtStyle] ?? "";
    const characterPrefix = buildAppearancePrefix(
      corrected.childName,
      corrected.age,
      corrected.pronouns,
      corrected.appearance
    );
    const basePrompt =
      target.illustrationPromptBase ??
      target.imagePrompt ??
      `${target.text}. Children's book illustration.`;
    const prompt = characterPrefix
      ? `${characterPrefix}. ${basePrompt}. ${styleSuffix}`
      : `${basePrompt}. ${styleSuffix}`;
    const finalPrompt = trimmedRegenReason
      ? `${prompt}. Parent requested change for this page: ${trimmedRegenReason}`
      : prompt;

    try {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      const result = await replicate.run(REPLICATE_FLUX_IMAGE_MODEL, {
        input: {
          prompt: finalPrompt,
          output_format: "png",
          aspect_ratio: "4:5",
          resolution: process.env.REPLICATE_FLUX_RESOLUTION?.trim() || "4 MP",
          safety_tolerance: 4,
        },
      });
      let imageUrl = "";
      if (typeof result === "string") imageUrl = result;
      else if (result && typeof result === "object" && "url" in result && typeof (result as { url: () => string }).url === "function") {
        imageUrl = (result as { url: () => string }).url();
      }
      if (!imageUrl) {
        return NextResponse.json({ error: "Failed to generate page image." }, { status: 500 });
      }

      const storagePath = `books/${bookId}/page-${pageIndex}.png`;
      const storedImageUrl = await uploadImageToStorage(imageUrl, storagePath);
      const finalImageUrl = storedImageUrl ?? imageUrl;
      const updatedPages = book.pages.map((p, idx) =>
        idx === pageIndex ? { ...p, imageUrl: finalImageUrl } : p
      );
      const ok = await updateBookPages(bookId, session.user.id, updatedPages);
      if (!ok) {
        return NextResponse.json({ error: "Failed to save regenerated page." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        cost: 0,
        pageIndex,
        book: { ...book, pages: updatedPages },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Single-page regeneration failed." },
        { status: 500 }
      );
    }
  }

  if (nameOnly) {
    const oldName = meta?.childName ?? "";
    const updatedTitle = replaceNameInText(book.title, oldName, corrected.childName);
    const updatedPages = book.pages.map((p) => ({
      ...p,
      text: replaceNameInText(p.text, oldName, corrected.childName),
    }));

    const ok = await updateBookForNameCorrection(bookId, session.user.id, {
      title: updatedTitle,
      pages: updatedPages,
      creationMetadata: corrected,
    });

    if (!ok) {
      return NextResponse.json(
        { error: "Failed to apply correction." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cost: 0,
      book: {
        ...book,
        title: updatedTitle,
        pages: updatedPages,
        creationMetadata: corrected,
      },
    });
  }

  if (!nameOnly) {
    const { limit, period } = await getBookLimitForUser(plan.billingUserId);
    const count = await getUserBookCountByPeriod(plan.billingUserId, period);
    const effectiveLimit = count === 0 ? limit + 1 : limit;
    if (count >= effectiveLimit) {
      return NextResponse.json(
        {
          error: `You've reached your book limit. This correction would use 1 credit. Upgrade your plan for more.`,
        },
        { status: 403 }
      );
    }

    const baseUrl =
      typeof request.url === "string"
        ? new URL(request.url).origin
        : process.env.NEXTAUTH_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        updateBookId: bookId,
        childName: corrected.childName,
        age: corrected.age,
        pronouns: corrected.pronouns,
        interests: corrected.interests,
        lifeLesson: corrected.lifeLesson,
        artStyle: corrected.artStyle,
        appearance: corrected.appearance,
        dedication: corrected.dedication,
        preferredVoice: corrected.preferredVoice,
        regenReason: trimmedRegenReason || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || "Regeneration failed." },
        { status: res.status }
      );
    }

    const regenerated = await res.json();

    return NextResponse.json({
      success: true,
      cost: 1,
      book: regenerated,
    });
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
