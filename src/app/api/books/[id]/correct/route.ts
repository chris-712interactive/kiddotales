import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBookById,
  getUserProfile,
  updateBookForNameCorrection,
  getBookLimitForUser,
  getUserBookCountByPeriod,
} from "@/lib/db";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getUserProfile(session.user.id);
  if (profile?.subscriptionTier === "free") {
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
  } = body as {
    childName?: string;
    age?: number;
    pronouns?: string;
    interests?: string[];
    lifeLesson?: string;
    artStyle?: string;
    appearance?: CharacterAppearance;
  };

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
    const { limit, period } = await getBookLimitForUser(session.user.id);
    const count = await getUserBookCountByPeriod(session.user.id, period);
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
