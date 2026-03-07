import { NextRequest, NextResponse } from "next/server";
import type { BookData } from "@/types";

/**
 * Fetches all book images server-side and returns base64 data URLs.
 * Used for PDF generation - avoids CORS issues in react-pdf.
 */
export async function POST(request: NextRequest) {
  try {
    const book = (await request.json()) as BookData;
    if (!book?.pages) {
      return NextResponse.json({ error: "Invalid book data" }, { status: 400 });
    }

    const pagesWithDataUrls = await Promise.all(
      book.pages.map(async (p) => {
        if (!p.imageUrl) return { ...p, imageUrl: undefined };
        try {
          const res = await fetch(p.imageUrl, {
            headers: { "User-Agent": "KiddoTales/1.0" },
          });
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/png";
          const dataUrl = `data:${contentType};base64,${base64}`;
          return { ...p, imageUrl: dataUrl };
        } catch (err) {
          console.warn("Could not fetch image for PDF:", p.imageUrl, err);
          return { ...p, imageUrl: undefined };
        }
      })
    );

    const preparedBook: BookData = { ...book, pages: pagesWithDataUrls };
    return NextResponse.json(preparedBook);
  } catch (err) {
    console.error("Prepare PDF error:", err);
    return NextResponse.json({ error: "Failed to prepare PDF" }, { status: 500 });
  }
}
