import { getBookById } from "./db";
import {
  createPrintJobCostCalculation,
  isLuluConfigured,
  type LuluCostCalculationResponse,
  type LuluShippingAddress,
  type LuluShippingOption,
} from "./lulu";
import {
  getActivePrintPricingRules,
  getPrintProductConfig,
  listActivePrintBookStyles,
  resolvePrintBookStyleForOrder,
  type PrintBookStyleRow,
} from "./print-db";
import { computeRetailCents, luluDecimalToCents } from "./print-pricing";
import { getLuluInteriorPageCount } from "./print-pdf";
import type { BookData } from "@/types";

export type PrintQuoteResult =
  | {
      ok: true;
      book: BookData;
      pageCount: number;
      podPackageId: string;
      printBookStyle: PrintBookStyleRow;
      lulu: LuluCostCalculationResponse;
      retailCents: number;
      wholesaleCents: number;
      currency: string;
    }
  | { ok: false; error: string; status: number };

export async function computePrintQuoteForBook(params: {
  userId: string;
  bookId: string;
  shippingAddress: LuluShippingAddress;
  shippingOption: LuluShippingOption;
  printBookStyleId?: string | null;
}): Promise<PrintQuoteResult> {
  const product = await getPrintProductConfig();
  if (!product?.printsEnabled) {
    return { ok: false, error: "Print ordering is not available", status: 403 };
  }

  if (!isLuluConfigured()) {
    return { ok: false, error: "Print service is not configured", status: 503 };
  }

  const rules = await getActivePrintPricingRules();
  if (!rules) {
    return { ok: false, error: "Print pricing is not configured", status: 503 };
  }

  const activeStyles = await listActivePrintBookStyles();
  if (activeStyles.length === 0) {
    return {
      ok: false,
      error: "No print formats are configured yet. Add a book style in admin.",
      status: 503,
    };
  }

  if (!product.allowedShippingOptions.includes(params.shippingOption)) {
    return { ok: false, error: "Invalid shipping option", status: 400 };
  }

  const book = await getBookById(params.bookId, params.userId);
  if (!book) {
    return { ok: false, error: "Book not found", status: 404 };
  }

  const pageCount = getLuluInteriorPageCount(book);
  if (pageCount < 1) {
    return { ok: false, error: "Book has no printable pages", status: 400 };
  }

  const printBookStyle = await resolvePrintBookStyleForOrder(
    params.printBookStyleId ?? null
  );
  if (!printBookStyle) {
    if (params.printBookStyleId) {
      return { ok: false, error: "Invalid or inactive print format", status: 400 };
    }
    return { ok: false, error: "No print formats available", status: 503 };
  }

  const podPackageId = printBookStyle.podPackageId;

  let lulu: LuluCostCalculationResponse;
  try {
    lulu = await createPrintJobCostCalculation({
      line_items: [
        {
          page_count: pageCount,
          pod_package_id: podPackageId,
          quantity: 1,
        },
      ],
      shipping_address: params.shippingAddress,
      shipping_option: params.shippingOption,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lulu cost calculation failed";
    console.error("[print-quote]", e);
    return { ok: false, error: msg, status: 502 };
  }

  const wholesaleCents = luluDecimalToCents(lulu.total_cost_incl_tax);
  const retailCents = computeRetailCents(wholesaleCents, rules);
  const currency = (lulu.currency || "USD").toUpperCase();

  return {
    ok: true,
    book,
    pageCount,
    podPackageId,
    printBookStyle,
    lulu,
    retailCents,
    wholesaleCents,
    currency,
  };
}
