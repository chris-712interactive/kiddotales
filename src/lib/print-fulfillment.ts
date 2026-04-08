import type { BookData, PrintCoverTitleLayout } from "@/types";
import { getBookById } from "./db";
import {
  createPrintJob,
  getCoverDimensions,
  type LuluShippingAddress,
  type LuluShippingOption,
} from "./lulu";
import {
  getPrintBookStyleById,
  getPrintProductConfig,
  updatePrintOrder,
  type PrintOrderRow,
} from "./print-db";
import {
  buildLuluCoverPdf,
  buildLuluInteriorPdf,
  LULU_INTERIOR_HEIGHT,
  LULU_INTERIOR_WIDTH,
  trimInchesToInteriorPoints,
  type CoverLayoutSpecs,
} from "./print-pdf";
import { uploadPrintPdfBuffer } from "./supabase-storage";

/** Same PDFs submitted to Lulu at fulfillment time; used for quote-time preview downloads. */
export async function buildLuluInteriorAndCoverPdfBuffers(params: {
  book: BookData;
  podPackageId: string;
  printBookStyleId: string | null;
  titleLayout?: PrintCoverTitleLayout | null;
}): Promise<{ interiorBytes: Uint8Array; coverBytes: Uint8Array; pageCount: number }> {
  let widthPt = LULU_INTERIOR_WIDTH;
  let heightPt = LULU_INTERIOR_HEIGHT;
  let coverLayoutSpecs: CoverLayoutSpecs | undefined;
  if (params.printBookStyleId) {
    const st = await getPrintBookStyleById(params.printBookStyleId);
    if (st) {
      const pts = trimInchesToInteriorPoints(st.trimWidthIn, st.trimHeightIn);
      widthPt = pts.widthPt;
      heightPt = pts.heightPt;
      coverLayoutSpecs = {
        safeMarginPt: Math.max(0, st.coverSafeMarginIn) * 72,
        bleedPt: Math.max(0, st.coverBleedIn) * 72,
        spineWidthPt:
          st.spineWidthIn != null && Number.isFinite(st.spineWidthIn)
            ? Math.max(8, st.spineWidthIn * 72)
            : null,
      };
    }
  }

  const { pdfBytes, pageCount } = await buildLuluInteriorPdf(params.book, {
    widthPt,
    heightPt,
  });

  const dims = await getCoverDimensions({
    pod_package_id: params.podPackageId,
    interior_page_count: pageCount,
    unit: "pt",
  });
  const coverW = parseFloat(dims.width);
  const coverH = parseFloat(dims.height);
  if (!Number.isFinite(coverW) || !Number.isFinite(coverH)) {
    throw new Error("Invalid cover dimensions from Lulu");
  }

  const coverBytes = await buildLuluCoverPdf(params.book, coverW, coverH, {
    trimWidthPt: widthPt,
    trimHeightPt: heightPt,
    titleLayout:
      params.titleLayout ?? params.book.creationMetadata?.printCoverTitleLayout ?? null,
    coverLayoutSpecs,
  });
  return { interiorBytes: pdfBytes, coverBytes, pageCount };
}

export async function buildAndUploadPrintQuotePdfs(params: {
  book: BookData;
  userId: string;
  bookId: string;
  podPackageId: string;
  printBookStyleId: string | null;
  titleLayout?: PrintCoverTitleLayout | null;
}): Promise<
  | { ok: true; interiorPdfUrl: string; coverPdfUrl: string }
  | { ok: false; error: string }
> {
  try {
    const { interiorBytes, coverBytes } = await buildLuluInteriorAndCoverPdfBuffers({
      book: params.book,
      podPackageId: params.podPackageId,
      printBookStyleId: params.printBookStyleId,
      titleLayout: params.titleLayout ?? null,
    });
    const styleSeg = params.printBookStyleId ?? "default";
    // Use versioned filenames so quote re-runs don't get stale CDN/browser cached PDFs.
    const revision = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const base = `print/quote-preview/${params.userId}/${params.bookId}/${styleSeg}/${revision}`;
    const interiorUrl = await uploadPrintPdfBuffer(
      Buffer.from(interiorBytes),
      `${base}/interior.pdf`
    );
    const coverUrl = await uploadPrintPdfBuffer(
      Buffer.from(coverBytes),
      `${base}/cover.pdf`
    );
    if (!interiorUrl || !coverUrl) {
      return { ok: false, error: "Failed to upload preview PDFs" };
    }
    return { ok: true, interiorPdfUrl: interiorUrl, coverPdfUrl: coverUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[print] buildAndUploadPrintQuotePdfs:", e);
    return { ok: false, error: msg };
  }
}

function contactEmailForLulu(): string {
  const fromEnv =
    process.env.LULU_CONTACT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    "";
  return fromEnv.trim() || "support@kiddotales.com";
}

export async function fulfillPrintOrderToLulu(order: PrintOrderRow): Promise<void> {
  const config = await getPrintProductConfig();
  const contact =
    config?.contactEmail?.trim() || contactEmailForLulu();

  const book = await getBookById(order.bookId, order.userId);
  if (!book) {
    await updatePrintOrder(order.id, {
      status: "failed",
      errorMessage: "Book not found",
    });
    return;
  }

  await updatePrintOrder(order.id, { status: "building_files", errorMessage: null });

  let interiorUrl: string | null = null;
  let coverUrl: string | null = null;

  try {
    const { interiorBytes, coverBytes, pageCount } =
      await buildLuluInteriorAndCoverPdfBuffers({
        book,
        podPackageId: order.podPackageId,
        printBookStyleId: order.printBookStyleId,
      });
    if (pageCount !== order.pageCount) {
      console.warn(
        `[print] page count mismatch order=${order.pageCount} pdf=${pageCount}, using ${pageCount}`
      );
    }

    const interiorPath = `print/${order.id}/interior.pdf`;
    const coverPath = `print/${order.id}/cover.pdf`;

    interiorUrl = await uploadPrintPdfBuffer(
      Buffer.from(interiorBytes),
      interiorPath
    );
    coverUrl = await uploadPrintPdfBuffer(Buffer.from(coverBytes), coverPath);

    if (!interiorUrl || !coverUrl) {
      throw new Error("Failed to upload print PDFs to storage");
    }

    await updatePrintOrder(order.id, {
      interiorPdfUrl: interiorUrl,
      coverPdfUrl: coverUrl,
    });

    const addr = order.shippingAddress as LuluShippingAddress;
    const shippingLevel = order.shippingOption as LuluShippingOption;

    const job = await createPrintJob({
      contact_email: contact,
      external_id: order.id,
      shipping_level: shippingLevel,
      shipping_address: addr,
      line_items: [
        {
          external_id: `${order.id}-1`,
          title: book.title,
          quantity: 1,
          printable_normalization: {
            pod_package_id: order.podPackageId,
            interior: { source_url: interiorUrl },
            cover: { source_url: coverUrl },
          },
        },
      ],
    });

    const jobId = job.id != null ? String(job.id) : null;
    const statusName = job.status?.name ?? "CREATED";

    await updatePrintOrder(order.id, {
      status: "submitted_to_lulu",
      luluPrintJobId: jobId,
      luluJobStatus: statusName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[print] fulfillPrintOrderToLulu:", e);
    await updatePrintOrder(order.id, {
      status: "failed",
      errorMessage: msg,
      interiorPdfUrl: interiorUrl,
      coverPdfUrl: coverUrl,
    });
  }
}
