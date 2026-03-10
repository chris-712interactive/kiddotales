import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import {
  getBookById,
  getUserProfile,
  getBookLimitForUser,
  getUserVoiceCountByPeriod,
  hasBookUsedVoiceSlot,
  insertVoiceUsageEvent,
  updateBookPagesWithAudio,
} from "@/lib/db";
import {
  getVoiceLimitForTier,
  getVoicesForTier,
  TTS_DEFAULT_VOICE,
} from "@/lib/stripe";
import { uploadAudioToStorage } from "@/lib/supabase-storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** POST: Generate AI voice for one or more pages. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "Book ID required" }, { status: 400 });
  }

  const userId = session.user.id as string;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI voice is not configured." },
      { status: 500 }
    );
  }

  try {
    const book = await getBookById(bookId, userId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const profile = await getUserProfile(userId);
    const tier = profile?.subscriptionTier ?? "free";

    if (tier === "free") {
      return NextResponse.json(
        { error: "Upgrade to Spark or higher for AI voice read-aloud." },
        { status: 403 }
      );
    }

    const voiceLimit = getVoiceLimitForTier(tier);
    const allowedVoices = getVoicesForTier(tier);
    const preferredVoice =
      book.creationMetadata?.preferredVoice ?? TTS_DEFAULT_VOICE;
    const voice = allowedVoices.includes(preferredVoice)
      ? preferredVoice
      : allowedVoices[0] ?? TTS_DEFAULT_VOICE;

    const { limit: _bookLimit, period } = await getBookLimitForUser(userId);
    const voiceCount = await getUserVoiceCountByPeriod(userId, period);
    const alreadyUsed = await hasBookUsedVoiceSlot(bookId);

    if (!alreadyUsed && voiceCount >= voiceLimit) {
      return NextResponse.json(
        {
          error: `You've reached your AI voice limit of ${voiceLimit} books this month. Upgrade for more or try again next month.`,
        },
        { status: 403 }
      );
    }

    let body: { pageIndices?: number[] } = {};
    try {
      body = await req.json().catch(() => ({}));
    } catch {
      // empty body ok
    }

    const pageIndices =
      body.pageIndices ?? book.pages.map((_, i) => i);
    const validIndices = pageIndices.filter(
      (i) => i >= 0 && i < book.pages.length
    );

    if (validIndices.length === 0) {
      return NextResponse.json(
        { error: "No valid pages to generate audio for." },
        { status: 400 }
      );
    }

    const audioUrls: Record<number, string> = {};
    const updates: { pageIndex: number; audioUrl: string; audioVoice: string }[] =
      [];

    for (const pageIndex of validIndices) {
      const page = book.pages[pageIndex];
      const text = page?.text?.trim();
      if (!text) continue;

      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "marin" | "nova" | "onyx" | "sage" | "shimmer" | "verse" | "cedar",
        input: text.slice(0, 4096),
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const path = `books/${bookId}/audio/page-${pageIndex}.mp3`;
      const audioUrl = await uploadAudioToStorage(buffer, path);
      if (audioUrl) {
        audioUrls[pageIndex] = audioUrl;
        updates.push({ pageIndex, audioUrl, audioVoice: voice });
      }
    }

    if (updates.length > 0) {
      await updateBookPagesWithAudio(bookId, userId, updates);

      if (!alreadyUsed) {
        await insertVoiceUsageEvent(userId, bookId);
      }
    }

    return NextResponse.json({
      audioUrls,
      voice,
    });
  } catch (err) {
    console.error("[KiddoTales] Audio generation error:", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to generate audio.",
      },
      { status: 500 }
    );
  }
}
