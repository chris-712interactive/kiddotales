import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import type { BookData } from "@/types";

const A4_PORTRAIT = { width: 595, height: 842 };
const A4_LANDSCAPE = { width: 842, height: 595 };

// Children's book spread layout: image left, text right (when book is open)
const OUTER_MARGIN = 40;
const INNER_MARGIN = 55; // Gutter for binding
const IMAGE_MARGIN = 25; // Minimal margin on image page
const TEXT_PAGE_PADDING = 50;
const TEXT_FONT_SIZE = 22; // Larger for children
const LINE_HEIGHT = 1.6;
const PAGE_NUM_SIZE = 10;

const TEXT_COLOR = rgb(0.18, 0.2, 0.26);
const PAGE_NUM_COLOR = rgb(0.55, 0.58, 0.65);

/**
 * Word-wrap text to fit within maxWidth.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Fetches and embeds an image from URL or base64 data URL. Returns image + dims or null.
 */
async function embedImage(
  pdfDoc: PDFDocument,
  source: { imageData?: string; imageUrl?: string }
): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | null> {
  const imageSource = source.imageData || source.imageUrl;
  if (!imageSource) return null;

  try {
    let bytes: Uint8Array;
    let isPng = true;

    if (source.imageData?.startsWith("data:")) {
      const base64 = source.imageData.split(",")[1];
      if (!base64) return null;
      const mime = source.imageData.match(/data:([^;]+)/)?.[1] || "";
      bytes = new Uint8Array(Buffer.from(base64, "base64"));
      if (mime.includes("webp")) {
        bytes = new Uint8Array(
          await sharp(Buffer.from(bytes)).png().toBuffer()
        );
      }
      isPng = mime.includes("png") || mime.includes("webp");
    } else {
      const res = await fetch(source.imageUrl!, {
        headers: { "User-Agent": "KiddoTales/1.0" },
      });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("webp")) {
        bytes = new Uint8Array(
          await sharp(Buffer.from(bytes)).png().toBuffer()
        );
      }
      isPng = contentType.includes("png") || contentType.includes("webp");
    }

    const image = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    return { image, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

/**
 * Generates a children's book PDF: image fills left page, large text on right page.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as
      | { book: BookData; orientation?: "portrait" | "landscape" }
      | BookData;
    const book = "book" in body ? body.book : body;
    const orientation =
      "orientation" in body && body.orientation
        ? body.orientation
        : "portrait";

    if (!book?.pages) {
      return NextResponse.json({ error: "Invalid book data" }, { status: 400 });
    }

    const pageSize =
      orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
    const imagePageWidth = pageSize.width - IMAGE_MARGIN * 2;
    const imagePageHeight = pageSize.height - IMAGE_MARGIN * 2;
    const textPageWidth = pageSize.width - INNER_MARGIN - OUTER_MARGIN - TEXT_PAGE_PADDING * 2;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // ---- Cover ----
    const coverPage = pdfDoc.addPage([pageSize.width, pageSize.height]);
    const coverCenterX = pageSize.width / 2;
    const coverCenterY = pageSize.height / 2;

    const coverSource = {
      imageData: book.coverImageData,
      imageUrl: book.coverImageUrl,
    };
    const baseTitleSize = 32;
    const subtitleSize = 14;
    const maxTitleWidth = pageSize.width - 80;
    let titleSize = baseTitleSize;
    let titleWidth = fontBold.widthOfTextAtSize(book.title, titleSize);
    if (titleWidth > maxTitleWidth) {
      titleSize = Math.max(14, Math.floor(baseTitleSize * (maxTitleWidth / titleWidth)));
      titleWidth = fontBold.widthOfTextAtSize(book.title, titleSize);
    }
    const subtitleWidth = font.widthOfTextAtSize("A KiddoTales Story", subtitleSize);
    const textBlockWidth = Math.max(titleWidth, subtitleWidth) + 48;
    const textBlockHeight = titleSize + 12 + 2 + 12 + subtitleSize; // title + gap + line + gap + subtitle
    const boxPadding = 20;

    const coverEmbedded = await embedImage(pdfDoc, coverSource);
    if (coverEmbedded) {
      const scaleX = pageSize.width / coverEmbedded.width;
      const scaleY = pageSize.height / coverEmbedded.height;
      const scale = Math.max(scaleX, scaleY);
      const drawWidth = coverEmbedded.width * scale;
      const drawHeight = coverEmbedded.height * scale;
      const imageX = (pageSize.width - drawWidth) / 2;
      const imageY = (pageSize.height - drawHeight) / 2;

      coverPage.drawImage(coverEmbedded.image, {
        x: imageX,
        y: imageY,
        width: drawWidth,
        height: drawHeight,
      });

      const boxWidth = textBlockWidth + boxPadding * 2;
      const boxHeight = textBlockHeight + boxPadding * 2;
      const boxX = coverCenterX - boxWidth / 2;
      const boxY = coverCenterY - boxHeight / 2;

      coverPage.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        opacity: 0.88,
      });

      const textTop = boxY + boxHeight - boxPadding;

      coverPage.drawText(book.title, {
        x: coverCenterX - titleWidth / 2,
        y: textTop - titleSize,
        size: titleSize,
        font: fontBold,
        color: rgb(0.15, 0.17, 0.22),
      });
      coverPage.drawRectangle({
        x: coverCenterX - (textBlockWidth - 16) / 2,
        y: textTop - titleSize - 12 - 1,
        width: textBlockWidth - 16,
        height: 2,
        color: rgb(0.85, 0.87, 0.92),
      });
      coverPage.drawText("A KiddoTales Story", {
        x: coverCenterX - subtitleWidth / 2,
        y: textTop - titleSize - 12 - 2 - 12 - subtitleSize,
        size: subtitleSize,
        font,
        color: rgb(0.45, 0.48, 0.55),
      });
    } else {
      coverPage.drawText(book.title, {
        x: coverCenterX - titleWidth / 2,
        y: coverCenterY + 25,
        size: titleSize,
        font: fontBold,
        color: rgb(0.15, 0.17, 0.22),
      });
      coverPage.drawRectangle({
        x: coverCenterX - titleWidth / 2 - 10,
        y: coverCenterY - 5,
        width: titleWidth + 20,
        height: 2,
        color: rgb(0.85, 0.87, 0.92),
      });
      coverPage.drawText("A KiddoTales Story", {
        x: coverCenterX - subtitleWidth / 2,
        y: coverCenterY - 35,
        size: subtitleSize,
        font,
        color: rgb(0.45, 0.48, 0.55),
      });
    }

    // ---- Story spreads: for each story page, add IMAGE first (left), then TEXT (right) ----
    // Order: image, text, image, text... (pages are recto/verso when printed)
    for (let i = 0; i < book.pages.length; i++) {
      const storyPage = book.pages[i];

      // 1. LEFT page (image fills page) - add first so it appears on left when spread is open
      const imagePage = pdfDoc.addPage([pageSize.width, pageSize.height]);
      const embedded = await embedImage(pdfDoc, storyPage);

      if (embedded) {
        const scaleX = imagePageWidth / embedded.width;
        const scaleY = imagePageHeight / embedded.height;
        const scale = Math.max(scaleX, scaleY);
        const drawWidth = embedded.width * scale;
        const drawHeight = embedded.height * scale;
        const imageX = IMAGE_MARGIN + (imagePageWidth - drawWidth) / 2;
        const imageY = pageSize.height - IMAGE_MARGIN - drawHeight;

        imagePage.drawImage(embedded.image, {
          x: imageX,
          y: imageY,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pageNum = `${i + 1}`;
      imagePage.drawText(pageNum, {
        x: pageSize.width / 2 - font.widthOfTextAtSize(pageNum, PAGE_NUM_SIZE) / 2,
        y: 30,
        size: PAGE_NUM_SIZE,
        font,
        color: PAGE_NUM_COLOR,
      });

      // 2. RIGHT page (text only) - add second so it appears on right when spread is open
      const textPage = pdfDoc.addPage([pageSize.width, pageSize.height]);
      const textContentWidth = pageSize.width - INNER_MARGIN - OUTER_MARGIN - TEXT_PAGE_PADDING * 2;

      const lines = wrapText(
        storyPage.text,
        font,
        TEXT_FONT_SIZE,
        textContentWidth
      );
      const lineHeightPt = TEXT_FONT_SIZE * LINE_HEIGHT;
      const textBlockHeight = lines.length * lineHeightPt;
      const textStartY = (pageSize.height + textBlockHeight) / 2; // Center text block vertically

      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        const lineWidth = font.widthOfTextAtSize(line, TEXT_FONT_SIZE);
        textPage.drawText(line, {
          x: INNER_MARGIN + TEXT_PAGE_PADDING + (textContentWidth - lineWidth) / 2,
          y: textStartY - (j + 1) * lineHeightPt,
          size: TEXT_FONT_SIZE,
          font,
          color: TEXT_COLOR,
        });
      }

      textPage.drawText(pageNum, {
        x: pageSize.width / 2 - font.widthOfTextAtSize(pageNum, PAGE_NUM_SIZE) / 2,
        y: 30,
        size: PAGE_NUM_SIZE,
        font,
        color: PAGE_NUM_COLOR,
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
