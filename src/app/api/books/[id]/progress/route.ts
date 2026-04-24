import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookById } from "@/lib/db";
import {
  getGenerationProgress,
  setGenerationProgress,
  subscribeGenerationProgress,
} from "@/lib/generation-progress";

type ProgressPayload = {
  completedSteps: number;
  totalSteps: number;
};

const TOTAL_IMAGE_STEPS = 10; // story + cover + 8 pages

function computeProgress(book: Awaited<ReturnType<typeof getBookById>>): ProgressPayload {
  if (!book) return { completedSteps: 0, totalSteps: TOTAL_IMAGE_STEPS };
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const completedPageImages = pages.filter(
    (p) => typeof p?.imageUrl === "string" && p.imageUrl.length > 0
  ).length;
  const completedSteps = Math.min(
    TOTAL_IMAGE_STEPS,
    1 + (book.coverImageUrl ? 1 : 0) + completedPageImages
  );
  return { completedSteps, totalSteps: TOTAL_IMAGE_STEPS };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Book ID required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const userId = session.user.id;

  let initial = getGenerationProgress(id);
  if (!initial) {
    const existing = await getBookById(id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    const bootstrapped = computeProgress(existing);
    initial = setGenerationProgress(id, bootstrapped.completedSteps, bootstrapped.totalSteps);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const unsubscribe = subscribeGenerationProgress(id, (payload) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      });
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
