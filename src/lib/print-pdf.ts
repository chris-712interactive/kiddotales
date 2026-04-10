import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import type { BookData, PrintCoverTitleLayout } from "@/types";

/** From print_book_styles: drives spine split + text safe inset on the Lulu wrap PDF. */
export type CoverLayoutSpecs = {
  safeMarginPt: number;
  bleedPt: number;
  /** When set, spine width in points; side bleed = (wrap − 2×trim − spine) / 2. */
  spineWidthPt: number | null;
};

/** US Letter — matches default 0850X1100 Lulu trim (8.5" × 11"). */
export const LULU_INTERIOR_WIDTH = 612;
export const LULU_INTERIOR_HEIGHT = 792;

/**
 * Effective DPI for raster content embedded in print PDFs (Lulu recommends 300+ for photos).
 * Text is rendered via SVG→PNG at this density; illustrations are resampled to match their on-page size.
 * Increase for sharper output (larger PDFs and uploads); decrease to save bandwidth.
 */
export const PRINT_RASTER_DPI = 300;

function pointsToPrintPixels(pt: number): number {
  return Math.max(1, Math.round((pt * PRINT_RASTER_DPI) / 72));
}

/** PDF points from trim size (72 pt per inch). */
export function trimInchesToInteriorPoints(trimWidthIn: number, trimHeightIn: number) {
  const w = Math.round(Number(trimWidthIn) * 72);
  const h = Math.round(Number(trimHeightIn) * 72);
  return {
    widthPt: Math.max(72, w),
    heightPt: Math.max(72, h),
  };
}

const MARGIN = 40;
const LINE_HEIGHT_MULT = 1.45;

function wrapTextApprox(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function decodeBookImageBuffer(
  source: { imageData?: string; imageUrl?: string }
): Promise<Buffer | null> {
  const imageSource = source.imageData || source.imageUrl;
  if (!imageSource) return null;
  try {
    let buf: Buffer;
    if (source.imageData?.startsWith("data:")) {
      const base64 = source.imageData.split(",")[1];
      if (!base64) return null;
      const mime = source.imageData.match(/data:([^;]+)/)?.[1] || "";
      buf = Buffer.from(base64, "base64");
      if (mime.includes("webp")) {
        buf = await sharp(buf).png().toBuffer();
      }
    } else {
      const res = await fetch(source.imageUrl!, {
        headers: { "User-Agent": "KiddoTales/1.0" },
      });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("webp")) {
        buf = await sharp(buf).png().toBuffer();
      }
    }
    return buf;
  } catch {
    return null;
  }
}

/** Resample so drawing at drawWidthPt×drawHeightPt (points) yields ~PRINT_RASTER_DPI. */
async function resampleBufferForPrintDraw(
  buf: Buffer,
  drawWidthPt: number,
  drawHeightPt: number,
  fit: "inside" | "cover",
  output: "png" | "jpeg" = "png"
): Promise<Buffer> {
  const tw = pointsToPrintPixels(drawWidthPt);
  const th = pointsToPrintPixels(drawHeightPt);
  const pipeline = sharp(buf)
    .resize({
      width: tw,
      height: th,
      fit,
      ...(fit === "cover" ? { position: "centre" as const } : {}),
      kernel: sharp.kernel.lanczos3,
    });
  if (output === "jpeg") {
    return pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
  return pipeline.png({ compressionLevel: 6 }).toBuffer();
}

type EmbeddedImage =
  | Awaited<ReturnType<PDFDocument["embedPng"]>>
  | Awaited<ReturnType<PDFDocument["embedJpg"]>>;

async function embedPageImageForPrint(
  pdfDoc: PDFDocument,
  source: { imageData?: string; imageUrl?: string },
  maxWidthPt: number,
  maxHeightPt: number
): Promise<{
  image: EmbeddedImage;
  drawWidthPt: number;
  drawHeightPt: number;
} | null> {
  const buf = await decodeBookImageBuffer(source);
  if (!buf) return null;
  try {
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1;
    const ih = meta.height ?? 1;
    const s = Math.min(maxWidthPt / iw, maxHeightPt / ih);
    const drawWidthPt = iw * s;
    const drawHeightPt = ih * s;
    const out = await resampleBufferForPrintDraw(
      buf,
      drawWidthPt,
      drawHeightPt,
      "inside",
      "jpeg"
    );
    const image = await pdfDoc.embedJpg(out);
    return { image, drawWidthPt, drawHeightPt };
  } catch {
    return null;
  }
}

async function embedCoverImageForPrint(
  pdfDoc: PDFDocument,
  source: { imageData?: string; imageUrl?: string },
  pageWidthPt: number,
  pageHeightPt: number
): Promise<{
  image: EmbeddedImage;
  drawWidthPt: number;
  drawHeightPt: number;
} | null> {
  const buf = await decodeBookImageBuffer(source);
  if (!buf) return null;
  try {
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1;
    const ih = meta.height ?? 1;
    const s = Math.max(pageWidthPt / iw, pageHeightPt / ih);
    const drawWidthPt = iw * s;
    const drawHeightPt = ih * s;
    const out = await resampleBufferForPrintDraw(
      buf,
      drawWidthPt,
      drawHeightPt,
      "cover",
      "jpeg"
    );
    const image = await pdfDoc.embedJpg(out);
    return { image, drawWidthPt, drawHeightPt };
  } catch {
    return null;
  }
}

async function embedKiddoLogoForCover(
  pdfDoc: PDFDocument,
  maxWidthPt: number,
  maxHeightPt: number
): Promise<{ image: EmbeddedImage; drawWidthPt: number; drawHeightPt: number } | null> {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "branding",
      "KiddoTalesLogoCircleNoBackground.svg"
    );
    const svgBytes = await readFile(logoPath);
    const targetW = Math.max(24, pointsToPrintPixels(maxWidthPt));
    const targetH = Math.max(24, pointsToPrintPixels(maxHeightPt));
    const png = await sharp(svgBytes)
      .resize({ width: targetW, height: targetH, fit: "contain", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6 })
      .toBuffer();
    const image = await pdfDoc.embedPng(png);
    const scale = Math.min(maxWidthPt / image.width, maxHeightPt / image.height);
    return {
      image,
      drawWidthPt: image.width * scale,
      drawHeightPt: image.height * scale,
    };
  } catch {
    return null;
  }
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function renderTextBlockPng(params: {
  widthPt: number;
  heightPt: number;
  lines: string[];
  fontSizePt: number;
  lineHeightPt: number;
  italic?: boolean;
  textColorHex?: string;
  textAlign?: "left" | "center" | "right";
}): Promise<Buffer> {
  const scale = PRINT_RASTER_DPI / 72;
  const w = Math.max(1, Math.round(params.widthPt * scale));
  const h = Math.max(1, Math.round(params.heightPt * scale));
  const fs = params.fontSizePt * scale;
  const lh = params.lineHeightPt * scale;
  const pad = 10 * scale;
  const textColor = params.textColorHex || "#2f3442";
  const style = params.italic ? "font-style: italic;" : "";
  const textAlign = params.textAlign ?? "left";
  const xPos = textAlign === "center" ? w / 2 : textAlign === "right" ? w - pad : pad;
  const anchor =
    textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
  const tspans = params.lines
    .map((line, i) => {
      const y = pad + fs + i * lh;
      return `<tspan x="${xPos}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="white" fill-opacity="0"/>
  <text font-size="${fs}" fill="${textColor}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif" ${style}>${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function autoTitleLayoutFromCoverPixels(
  pixels: Uint8Array,
  width: number,
  height: number
): PrintCoverTitleLayout {
  const candidates: Array<Pick<PrintCoverTitleLayout, "x" | "y" | "width" | "align">> = [
    { x: 0.05, y: 0.07, width: 0.84, align: "left" },
    { x: 0.08, y: 0.07, width: 0.84, align: "center" },
    { x: 0.11, y: 0.07, width: 0.84, align: "right" },
    { x: 0.05, y: 0.45, width: 0.84, align: "left" },
    { x: 0.08, y: 0.45, width: 0.84, align: "center" },
    { x: 0.11, y: 0.45, width: 0.84, align: "right" },
    { x: 0.05, y: 0.72, width: 0.84, align: "left" },
    { x: 0.08, y: 0.72, width: 0.84, align: "center" },
    { x: 0.11, y: 0.72, width: 0.84, align: "right" },
  ];
  const boxH = Math.max(24, Math.floor(height * 0.2));
  const sampleStep = 2;

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const x0 = Math.max(0, Math.floor(c.x * width));
    const y0 = Math.max(0, Math.floor(c.y * height));
    const bw = Math.max(16, Math.floor(c.width * width));
    const bh = Math.min(height - y0, boxH);
    if (bw <= 0 || bh <= 0) continue;
    let n = 0;
    let sum = 0;
    let sumSq = 0;
    let edge = 0;
    for (let y = y0; y < y0 + bh; y += sampleStep) {
      for (let x = x0; x < x0 + bw; x += sampleStep) {
        const i = y * width + x;
        const v = pixels[i] ?? 0;
        sum += v;
        sumSq += v * v;
        if (x + 1 < width) edge += Math.abs(v - (pixels[i + 1] ?? v));
        if (y + 1 < height) edge += Math.abs(v - (pixels[i + width] ?? v));
        n += 1;
      }
    }
    if (n === 0) continue;
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const edgeNorm = edge / n;
    const contrastPenalty = Math.abs(mean - 128) * -0.12;
    const score = variance + edgeNorm * 1.35 + contrastPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { ...best, fontSizePt: 34 };
}

async function autoTitleLayoutFromCover(
  source: { imageData?: string; imageUrl?: string }
): Promise<PrintCoverTitleLayout | null> {
  const buf = await decodeBookImageBuffer(source);
  if (!buf) return null;
  try {
    const w = 240;
    const h = 300;
    const raw = await sharp(buf)
      .resize({ width: w, height: h, fit: "cover", position: "centre" })
      .grayscale()
      .raw()
      .toBuffer();
    return autoTitleLayoutFromCoverPixels(new Uint8Array(raw), w, h);
  } catch {
    return null;
  }
}

/** Interior page count for Lulu (cover is separate): dedication/blank + (image,text) per story page. */
export function getLuluInteriorPageCount(book: BookData): number {
  return 1 + book.pages.length * 2;
}

/**
 * Interior PDF for Lulu:
 * - First interior page is always reserved for dedication (or blank if none)
 * - Then each story spread is two pages: illustration page, then large text page
 */
export async function buildLuluInteriorPdf(
  book: BookData,
  options?: { widthPt?: number; heightPt?: number }
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const w = options?.widthPt ?? LULU_INTERIOR_WIDTH;
  const h = options?.heightPt ?? LULU_INTERIOR_HEIGHT;
  const pdfDoc = await PDFDocument.create();
  const contentW = w - MARGIN * 2;

  const dedicationPage = pdfDoc.addPage([w, h]);
  const hasDedication = Boolean(book.dedication?.message || book.dedication?.from);
  if (hasDedication && book.dedication) {
    const fs = 20;
    const maxChars = Math.max(18, Math.floor(contentW / (fs * 0.52)));
    const lines = wrapTextApprox(book.dedication.message, maxChars);
    const fromLine = book.dedication.from ? `- ${book.dedication.from}` : null;
    const allLines = fromLine ? [...lines, "", fromLine] : lines;
    const lh = Math.round(fs * LINE_HEIGHT_MULT);
    const textH = Math.max(60, allLines.length * lh + 24);
    const textW = Math.max(120, Math.floor(contentW));
    const textPng = await renderTextBlockPng({
      widthPt: textW,
      heightPt: textH,
      lines: allLines,
      fontSizePt: fs,
      lineHeightPt: lh,
      italic: false,
    });
    const textImage = await pdfDoc.embedPng(textPng);
    dedicationPage.drawImage(textImage, {
      x: MARGIN,
      y: (h - textH) / 2,
      width: textW,
      height: textH,
    });
  }

  const textFontSize = 30;

  for (const p of book.pages) {
    const imagePage = pdfDoc.addPage([w, h]);
    const maxW = contentW;
    const maxH = h - MARGIN * 2;
    const embedded = await embedPageImageForPrint(
      pdfDoc,
      { imageData: p.imageData, imageUrl: p.imageUrl },
      maxW,
      maxH
    );
    if (embedded) {
      const { image, drawWidthPt: dw, drawHeightPt: dh } = embedded;
      const ix = MARGIN + (contentW - dw) / 2;
      const iy = MARGIN + (h - MARGIN * 2 - dh) / 2;
      imagePage.drawImage(image, { x: ix, y: iy, width: dw, height: dh });
    }

    const textPage = pdfDoc.addPage([w, h]);
    const maxChars = Math.max(14, Math.floor(contentW / (textFontSize * 0.55)));
    const lines = wrapTextApprox(p.text, maxChars);
    const lh = Math.round(textFontSize * LINE_HEIGHT_MULT);
    const textH = Math.max(120, lines.length * lh + 24);
    const textW = Math.max(120, Math.floor(contentW));
    const textPng = await renderTextBlockPng({
      widthPt: textW,
      heightPt: textH,
      lines,
      fontSizePt: textFontSize,
      lineHeightPt: lh,
      italic: false,
    });
    const textImage = await pdfDoc.embedPng(textPng);
    textPage.drawImage(textImage, {
      x: MARGIN,
      y: (h - textH) / 2,
      width: textW,
      height: textH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pageCount = pdfDoc.getPageCount();
  return { pdfBytes, pageCount };
}

/**
 * Full-bleed cover on Lulu-calculated wrap dimensions (single page).
 */
export async function buildLuluCoverPdf(
  book: BookData,
  widthPt: number,
  heightPt: number,
  options?: {
    trimWidthPt?: number;
    trimHeightPt?: number;
    titleLayout?: PrintCoverTitleLayout | null;
    coverLayoutSpecs?: CoverLayoutSpecs;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthPt, heightPt]);
  const trimW = Math.max(120, options?.trimWidthPt ?? Math.floor(widthPt / 2));
  const trimH = Math.max(120, options?.trimHeightPt ?? heightPt);
  const specs = options?.coverLayoutSpecs;
  const safePt = Math.max(6, specs?.safeMarginPt ?? 0.25 * 72);
  const bleedPt = Math.max(0, specs?.bleedPt ?? 0.125 * 72);
  /** Inset for type inside each trim panel (away from cut / fold). */
  const textInsetPt = Math.max(safePt, bleedPt);

  let spineW: number;
  let sideBleedW: number;
  if (specs?.spineWidthPt != null && Number.isFinite(specs.spineWidthPt)) {
    spineW = Math.max(8, specs.spineWidthPt);
    sideBleedW = Math.max(0, (widthPt - (trimW * 2 + spineW)) / 2);
  } else {
    spineW = Math.max(8, widthPt - trimW * 2);
    sideBleedW = Math.max(0, (widthPt - (trimW * 2 + spineW)) / 2);
  }
  const topBottomBleed = Math.max(0, (heightPt - trimH) / 2);

  const backX = sideBleedW;
  const spineX = backX + trimW;
  const frontX = spineX + spineW;
  const panelY = topBottomBleed;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
    color: rgb(1, 1, 1),
  });

  const embedded = await embedCoverImageForPrint(
    pdfDoc,
    { imageData: book.coverImageData, imageUrl: book.coverImageUrl },
    trimW,
    trimH
  );
  if (embedded) {
    const { image, drawWidthPt: dw, drawHeightPt: dh } = embedded;
    page.drawImage(image, {
      x: frontX + (trimW - dw) / 2,
      y: panelY + (trimH - dh) / 2,
      width: dw,
      height: dh,
    });
  }

  const autoLayout =
    options?.titleLayout ??
    (await autoTitleLayoutFromCover({
      imageData: book.coverImageData,
      imageUrl: book.coverImageUrl,
    })) ?? { x: 0.08, y: 0.07, width: 0.84, fontSizePt: 34, align: "center" as const };
  const frontInnerLeft = frontX + textInsetPt;
  const frontInnerRight = frontX + trimW - textInsetPt;
  const frontInnerBottom = panelY + textInsetPt;
  const frontInnerTop = panelY + trimH - textInsetPt;
  const frontInnerW = Math.max(80, frontInnerRight - frontInnerLeft);

  const frontTitleSize = Math.max(16, Math.min(64, autoLayout.fontSizePt || 34));
  const requestedTitleW = Math.max(
    120,
    (trimW - 24) * Math.min(0.95, Math.max(0.35, autoLayout.width))
  );
  const frontTitleW = Math.min(requestedTitleW, frontInnerW);
  const normX = Math.min(1, Math.max(0, autoLayout.x));
  let titleX = frontInnerLeft + (frontInnerW - frontTitleW) * normX;
  const frontMaxChars = Math.max(10, Math.floor((frontTitleW - 14) / (frontTitleSize * 0.52)));
  const titleLines = wrapTextApprox(book.title || "KiddoTales Story", frontMaxChars).slice(0, 4);
  const frontTitleLh = Math.round(frontTitleSize * 1.18);
  const frontTitleH = Math.max(120, titleLines.length * frontTitleLh + 28);
  // UI uses top-origin vertical slider (0=top, 1=bottom), PDF uses bottom-origin y.
  // Convert so slider direction matches the on-screen preview.
  const yNorm = Math.min(1, Math.max(0, autoLayout.y));
  const titlePlatePadX = 14;
  const titlePlatePadY = 10;
  const minBottomY = frontInnerBottom + titlePlatePadY;
  const maxBottomY = frontInnerTop - frontTitleH - titlePlatePadY;
  let titleY = minBottomY + (1 - yNorm) * Math.max(0, maxBottomY - minBottomY);
  let plateLeft = titleX - titlePlatePadX;
  let plateRight = titleX + frontTitleW + titlePlatePadX;
  if (plateLeft < frontInnerLeft) {
    const d = frontInnerLeft - plateLeft;
    titleX += d;
    plateLeft += d;
    plateRight += d;
  }
  if (plateRight > frontInnerRight) {
    const d = plateRight - frontInnerRight;
    titleX -= d;
  }
  page.drawRectangle({
    x: titleX - titlePlatePadX,
    y: titleY - titlePlatePadY,
    width: frontTitleW + titlePlatePadX * 2,
    height: frontTitleH + titlePlatePadY * 2,
    color: rgb(0.06, 0.08, 0.15),
    opacity: 0.55,
  });
  const titlePng = await renderTextBlockPng({
    widthPt: frontTitleW,
    heightPt: frontTitleH,
    lines: titleLines,
    fontSizePt: frontTitleSize,
    lineHeightPt: frontTitleLh,
    textColorHex: "#f8fbff",
    textAlign: autoLayout.align,
  });
  const titleImage = await pdfDoc.embedPng(titlePng);
  page.drawImage(titleImage, {
    x: titleX,
    y: titleY,
    width: frontTitleW,
    height: frontTitleH,
  });

  const backInnerLeft = backX + textInsetPt;
  const backInnerRight = backX + trimW - textInsetPt;
  const backInnerBottom = panelY + textInsetPt;
  const backInnerW = Math.max(60, backInnerRight - backInnerLeft);

  const logo = await embedKiddoLogoForCover(pdfDoc, 32, 32);
  const logoW = logo?.drawWidthPt ?? 0;
  const logoH = logo?.drawHeightPt ?? 0;

  const badgeText = "Made with KiddoTales";
  const badgeH = 34;
  const badgeW = Math.min(backInnerW, Math.max(120, backInnerW * 0.82));
  const badgePng = await renderTextBlockPng({
    widthPt: badgeW,
    heightPt: badgeH,
    lines: [badgeText],
    fontSizePt: 18,
    lineHeightPt: 22,
    textAlign: "center",
  });
  const badgeImage = await pdfDoc.embedPng(badgePng);
  // Keep branding comfortably inside safe zone (Lulu warns quickly near bottom trim/bleed).
  const minLiftPt = Math.max(12, textInsetPt * 0.7);
  const stackGap = logo ? 4 : 0;
  const stackH = badgeH + (logo ? logoH + stackGap : 0);
  const stackBottomY = Math.min(
    panelY + trimH - textInsetPt - stackH,
    backInnerBottom + minLiftPt
  );
  const centerX = backInnerLeft + backInnerW / 2;
  const badgeX = centerX - badgeW / 2;
  const badgeY = stackBottomY;

  if (logo) {
    page.drawImage(logo.image, {
      x: centerX - logoW / 2,
      y: stackBottomY + badgeH + stackGap,
      width: logo.drawWidthPt,
      height: logo.drawHeightPt,
    });
  }
  page.drawImage(badgeImage, {
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
  });

  return pdfDoc.save();
}
