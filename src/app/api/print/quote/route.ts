import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/lib/db";
import { buildAndUploadPrintQuotePdfs } from "@/lib/print-fulfillment";
import { computePrintQuoteForBook } from "@/lib/print-quote";
import { parseShippingAddress, parseShippingOption } from "@/lib/print-address";
import type { PrintCoverTitleLayout } from "@/types";

function parseCoverTitleLayout(input: unknown): PrintCoverTitleLayout | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const fontSizePt = Number(o.fontSizePt);
  const align = String(o.align || "");
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(fontSizePt)) return null;
  if (!["left", "center", "right"].includes(align)) return null;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.35, Math.min(0.95, width)),
    fontSizePt: Math.max(16, Math.min(64, fontSizePt)),
    align: align as PrintCoverTitleLayout["align"],
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    bookId?: string;
    printBookStyleId?: string | null;
    shippingAddress?: unknown;
    shippingOption?: unknown;
    coverTitleLayout?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookId = String(body.bookId ?? "").trim();
  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const shippingAddress = parseShippingAddress(body.shippingAddress);
  if (!shippingAddress) {
    return NextResponse.json(
      { error: "Invalid shipping address (name, street1, city, postcode, country_code, phone, email required)" },
      { status: 400 }
    );
  }

  const shippingOption = parseShippingOption(body.shippingOption);
  if (!shippingOption) {
    return NextResponse.json({ error: "Invalid shipping option" }, { status: 400 });
  }

  const printBookStyleId =
    typeof body.printBookStyleId === "string" && body.printBookStyleId.trim()
      ? body.printBookStyleId.trim()
      : null;
  const coverTitleLayout = parseCoverTitleLayout(body.coverTitleLayout);

  const userId = session.user.id as string;
  await ensureUser(userId, session.user?.email ?? undefined);

  const quote = await computePrintQuoteForBook({
    userId,
    bookId,
    shippingAddress,
    shippingOption,
    printBookStyleId,
  });

  if (!quote.ok) {
    return NextResponse.json({ error: quote.error }, { status: quote.status });
  }

  const preview = await buildAndUploadPrintQuotePdfs({
    book: quote.book,
    userId,
    bookId,
    podPackageId: quote.podPackageId,
    printBookStyleId: quote.printBookStyle.id,
    titleLayout: coverTitleLayout,
  });

  return NextResponse.json({
    pageCount: quote.pageCount,
    podPackageId: quote.podPackageId,
    printBookStyle: {
      id: quote.printBookStyle.id,
      name: quote.printBookStyle.name,
      description: quote.printBookStyle.description,
      trimWidthIn: quote.printBookStyle.trimWidthIn,
      trimHeightIn: quote.printBookStyle.trimHeightIn,
    },
    currency: quote.currency,
    wholesaleTotalInclTax: quote.lulu.total_cost_incl_tax,
    retailCents: quote.retailCents,
    wholesaleCents: quote.wholesaleCents,
    lulu: quote.lulu,
    previewInteriorPdfUrl: preview.ok ? preview.interiorPdfUrl : null,
    previewCoverPdfUrl: preview.ok ? preview.coverPdfUrl : null,
    previewPdfError: preview.ok ? null : preview.error,
  });
}
