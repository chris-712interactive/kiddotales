import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import type { BookData } from "@/types";

const PAGE_WIDTH = 595; // A4 points (72 dpi)
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const IMAGE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const IMAGE_HEIGHT = 280;

/**
 * Generates PDF server-side with pdf-lib. Fetches images directly (no CORS).
 */
export async function POST(request: NextRequest) {
  try {
    const book = (await request.json()) as BookData;
    if (!book?.pages) {
      return NextResponse.json({ error: "Invalid book data" }, { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();

    // Cover page
    const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    coverPage.drawText(book.title, {
      x: PAGE_WIDTH / 2 - 100,
      y: PAGE_HEIGHT / 2 - 20,
      size: 28,
      color: rgb(0.12, 0.12, 0.18),
    });
    coverPage.drawText("A KiddoTales Story", {
      x: PAGE_WIDTH / 2 - 50,
      y: PAGE_HEIGHT / 2 - 50,
      size: 12,
      color: rgb(0.42, 0.45, 0.5),
    });

    // Story pages
    for (let i = 0; i < book.pages.length; i++) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const storyPage = book.pages[i];
      let y = PAGE_HEIGHT - MARGIN;

      if (storyPage.imageUrl) {
        try {
          const res = await fetch(storyPage.imageUrl, {
            headers: { "User-Agent": "KiddoTales/1.0" },
          });
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const contentType = (res.headers.get("content-type") || "").toLowerCase();
            if (contentType.includes("webp")) {
              throw new Error("WebP not supported by pdf-lib");
            }
            const image = contentType.includes("png")
              ? await pdfDoc.embedPng(bytes)
              : await pdfDoc.embedJpg(bytes);
            const dims = image.scaleToFit(IMAGE_WIDTH, IMAGE_HEIGHT);
            page.drawImage(image, {
              x: MARGIN,
              y: y - dims.height,
              width: dims.width,
              height: dims.height,
            });
            y -= dims.height + 20;
          }
        } catch (err) {
          console.warn("Could not add image to PDF:", err);
        }
      }

      page.drawText(storyPage.text, {
        x: MARGIN,
        y: y - 50,
        size: 14,
        color: rgb(0.22, 0.25, 0.32),
        maxWidth: PAGE_WIDTH - MARGIN * 2,
      });
      page.drawText(`${i + 1} / ${book.pages.length}`, {
        x: PAGE_WIDTH / 2 - 20,
        y: 30,
        size: 10,
        color: rgb(0.6, 0.64, 0.69),
      });
    }

    const pdfBytes = await pdfDoc.save();
    const copy = new Uint8Array(pdfBytes.length);
    copy.set(pdfBytes);
    return new NextResponse(new Blob([copy], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${book.title.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Generate PDF error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
