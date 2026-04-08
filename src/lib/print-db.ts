import { createSupabaseAdmin } from "./supabase";
import type { LuluCostCalculationResponse, LuluShippingAddress, LuluShippingOption } from "./lulu";
import type { PrintPricingRules } from "./print-pricing";

export type PrintProductConfigRow = {
  id: string;
  printsEnabled: boolean;
  defaultPodPackageId: string;
  contactEmail: string | null;
  defaultShippingOption: LuluShippingOption;
  allowedShippingOptions: LuluShippingOption[];
};

export type PrintPricingRulesRow = PrintPricingRules & {
  id: string;
  isActive: boolean;
};

export type PrintBookStyleRow = {
  id: string;
  podPackageId: string;
  name: string;
  description: string | null;
  trimWidthIn: number;
  trimHeightIn: number;
  /** Expected cover bleed (inches); used for layout reference / future tooling. */
  coverBleedIn: number;
  /** Keep text inside trim by at least this inset (inches) from cut/fold. */
  coverSafeMarginIn: number;
  /** Optional spine width (inches). When set, leftover wrap width becomes side bleed. */
  spineWidthIn: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PrintOrderRow = {
  id: string;
  userId: string;
  bookId: string;
  status: string;
  podPackageId: string;
  printBookStyleId: string | null;
  pageCount: number;
  shippingOption: string;
  shippingAddress: LuluShippingAddress;
  customerEmail: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  retailAmountCents: number;
  currency: string;
  wholesaleTotalInclTax: string | null;
  luluCostSnapshot: LuluCostCalculationResponse | null;
  luluPrintJobId: string | null;
  luluJobStatus: string | null;
  trackingUrls: unknown;
  interiorPdfUrl: string | null;
  coverPdfUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapConfig(row: Record<string, unknown>): PrintProductConfigRow {
  const allowed = (row.allowed_shipping_options as string[] | null) ?? [];
  return {
    id: String(row.id),
    printsEnabled: Boolean(row.prints_enabled),
    defaultPodPackageId: String(row.default_pod_package_id),
    contactEmail: (row.contact_email as string) ?? null,
    defaultShippingOption: String(row.default_shipping_option) as LuluShippingOption,
    allowedShippingOptions: (allowed.length
      ? allowed
      : ["MAIL", "GROUND", "EXPRESS"]) as LuluShippingOption[],
  };
}

function mapBookStyle(row: Record<string, unknown>): PrintBookStyleRow {
  return {
    id: String(row.id),
    podPackageId: String(row.pod_package_id),
    name: String(row.name),
    description: (row.description as string) ?? null,
    trimWidthIn: Number(row.trim_width_in) || 8.5,
    trimHeightIn: Number(row.trim_height_in) || 11,
    coverBleedIn:
      row.cover_bleed_in != null && Number.isFinite(Number(row.cover_bleed_in))
        ? Number(row.cover_bleed_in)
        : 0.125,
    coverSafeMarginIn:
      row.cover_safe_margin_in != null && Number.isFinite(Number(row.cover_safe_margin_in))
        ? Number(row.cover_safe_margin_in)
        : 0.25,
    spineWidthIn:
      row.spine_width_in != null && Number.isFinite(Number(row.spine_width_in))
        ? Number(row.spine_width_in)
        : null,
    sortOrder: Number(row.sort_order) || 0,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPricing(row: Record<string, unknown>): PrintPricingRulesRow {
  return {
    id: String(row.id),
    isActive: Boolean(row.is_active),
    markupPercent: Number(row.markup_percent) || 0,
    flatFeeCents: Number(row.flat_fee_cents) || 0,
    minRetailCents:
      row.min_retail_cents != null ? Number(row.min_retail_cents) : null,
    maxRetailCents:
      row.max_retail_cents != null ? Number(row.max_retail_cents) : null,
    roundToNineteen: Boolean(row.round_to_nineteen),
  };
}

export async function getPrintProductConfig(): Promise<PrintProductConfigRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_product_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error || !data) return null;
  return mapConfig(data as Record<string, unknown>);
}

export async function updatePrintProductConfig(
  patch: Partial<{
    printsEnabled: boolean;
    defaultPodPackageId: string;
    contactEmail: string | null;
    defaultShippingOption: LuluShippingOption;
    allowedShippingOptions: LuluShippingOption[];
  }>
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.printsEnabled !== undefined) row.prints_enabled = patch.printsEnabled;
  if (patch.defaultPodPackageId !== undefined)
    row.default_pod_package_id = patch.defaultPodPackageId;
  if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail;
  if (patch.defaultShippingOption !== undefined)
    row.default_shipping_option = patch.defaultShippingOption;
  if (patch.allowedShippingOptions !== undefined)
    row.allowed_shipping_options = patch.allowedShippingOptions;

  const { error } = await supabase
    .from("print_product_config")
    .update(row)
    .eq("id", "default");
  return !error;
}

export async function listActivePrintBookStyles(): Promise<PrintBookStyleRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_book_styles")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapBookStyle(r as Record<string, unknown>));
}

export async function getPrintBookStyleById(
  id: string,
  options?: { activeOnly?: boolean }
): Promise<PrintBookStyleRow | null> {
  const supabase = createSupabaseAdmin();
  let q = supabase.from("print_book_styles").select("*").eq("id", id);
  if (options?.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  return mapBookStyle(data as Record<string, unknown>);
}

export async function listPrintBookStylesAdmin(): Promise<PrintBookStyleRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_book_styles")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapBookStyle(r as Record<string, unknown>));
}

export async function createPrintBookStyle(params: {
  podPackageId: string;
  name: string;
  description?: string | null;
  trimWidthIn: number;
  trimHeightIn: number;
  coverBleedIn?: number;
  coverSafeMarginIn?: number;
  spineWidthIn?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<PrintBookStyleRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_book_styles")
    .insert({
      pod_package_id: params.podPackageId.trim(),
      name: params.name.trim(),
      description: params.description?.trim() || null,
      trim_width_in: params.trimWidthIn,
      trim_height_in: params.trimHeightIn,
      cover_bleed_in: params.coverBleedIn ?? 0.125,
      cover_safe_margin_in: params.coverSafeMarginIn ?? 0.25,
      spine_width_in: params.spineWidthIn ?? null,
      sort_order: params.sortOrder ?? 0,
      is_active: params.isActive ?? true,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[print_book_styles] insert:", error);
    return null;
  }
  return mapBookStyle(data as Record<string, unknown>);
}

export async function updatePrintBookStyle(
  id: string,
  patch: Partial<{
    podPackageId: string;
    name: string;
    description: string | null;
    trimWidthIn: number;
    trimHeightIn: number;
    coverBleedIn: number;
    coverSafeMarginIn: number;
    spineWidthIn: number | null;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.podPackageId !== undefined) row.pod_package_id = patch.podPackageId.trim();
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.trimWidthIn !== undefined) row.trim_width_in = patch.trimWidthIn;
  if (patch.trimHeightIn !== undefined) row.trim_height_in = patch.trimHeightIn;
  if (patch.coverBleedIn !== undefined) row.cover_bleed_in = patch.coverBleedIn;
  if (patch.coverSafeMarginIn !== undefined) row.cover_safe_margin_in = patch.coverSafeMarginIn;
  if (patch.spineWidthIn !== undefined) row.spine_width_in = patch.spineWidthIn;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { error } = await supabase.from("print_book_styles").update(row).eq("id", id);
  return !error;
}

export async function deletePrintBookStyle(id: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("print_book_styles").delete().eq("id", id);
  return !error;
}

/**
 * Resolve style for checkout: explicit id must be active; otherwise first active by sort.
 */
export async function resolvePrintBookStyleForOrder(
  styleId: string | null | undefined
): Promise<PrintBookStyleRow | null> {
  if (styleId) {
    return getPrintBookStyleById(styleId, { activeOnly: true });
  }
  const list = await listActivePrintBookStyles();
  return list[0] ?? null;
}

export async function getActivePrintPricingRules(): Promise<PrintPricingRulesRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_pricing_rules")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapPricing(data as Record<string, unknown>);
}

export async function updatePrintPricingRules(
  id: string,
  patch: Partial<PrintPricingRules>
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.markupPercent !== undefined) row.markup_percent = patch.markupPercent;
  if (patch.flatFeeCents !== undefined) row.flat_fee_cents = patch.flatFeeCents;
  if (patch.minRetailCents !== undefined) row.min_retail_cents = patch.minRetailCents;
  if (patch.maxRetailCents !== undefined) row.max_retail_cents = patch.maxRetailCents;
  if (patch.roundToNineteen !== undefined) row.round_to_nineteen = patch.roundToNineteen;

  const { error } = await supabase.from("print_pricing_rules").update(row).eq("id", id);
  return !error;
}

export async function createPrintOrder(params: {
  userId: string;
  bookId: string;
  podPackageId: string;
  printBookStyleId: string | null;
  pageCount: number;
  shippingOption: LuluShippingOption;
  shippingAddress: LuluShippingAddress;
  customerEmail: string | null;
  retailAmountCents: number;
  currency: string;
  wholesaleTotalInclTax: string | null;
  luluCostSnapshot: LuluCostCalculationResponse | null;
}): Promise<PrintOrderRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_orders")
    .insert({
      user_id: params.userId,
      book_id: params.bookId,
      status: "awaiting_payment",
      pod_package_id: params.podPackageId,
      print_book_style_id: params.printBookStyleId,
      page_count: params.pageCount,
      shipping_option: params.shippingOption,
      shipping_address: params.shippingAddress,
      customer_email: params.customerEmail,
      retail_amount_cents: params.retailAmountCents,
      currency: params.currency,
      wholesale_total_incl_tax: params.wholesaleTotalInclTax,
      lulu_cost_snapshot: params.luluCostSnapshot,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[print_orders] insert error:", error);
    return null;
  }
  return mapPrintOrder(data as Record<string, unknown>);
}

function mapPrintOrder(row: Record<string, unknown>): PrintOrderRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    bookId: String(row.book_id),
    status: String(row.status),
    podPackageId: String(row.pod_package_id),
    printBookStyleId: (row.print_book_style_id as string) ?? null,
    pageCount: Number(row.page_count),
    shippingOption: String(row.shipping_option),
    shippingAddress: row.shipping_address as LuluShippingAddress,
    customerEmail: (row.customer_email as string) ?? null,
    stripeCheckoutSessionId: (row.stripe_checkout_session_id as string) ?? null,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string) ?? null,
    retailAmountCents: Number(row.retail_amount_cents),
    currency: String(row.currency ?? "USD"),
    wholesaleTotalInclTax: (row.wholesale_total_incl_tax as string) ?? null,
    luluCostSnapshot: (row.lulu_cost_snapshot as LuluCostCalculationResponse) ?? null,
    luluPrintJobId: (row.lulu_print_job_id as string) ?? null,
    luluJobStatus: (row.lulu_job_status as string) ?? null,
    trackingUrls: row.tracking_urls,
    interiorPdfUrl: (row.interior_pdf_url as string) ?? null,
    coverPdfUrl: (row.cover_pdf_url as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getPrintOrderById(
  id: string,
  userId?: string
): Promise<PrintOrderRow | null> {
  const supabase = createSupabaseAdmin();
  let q = supabase.from("print_orders").select("*").eq("id", id);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  return mapPrintOrder(data as Record<string, unknown>);
}

export async function getPrintOrderByStripeSession(
  sessionId: string
): Promise<PrintOrderRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPrintOrder(data as Record<string, unknown>);
}

export async function updatePrintOrderStripeSession(
  orderId: string,
  sessionId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("print_orders")
    .update({
      stripe_checkout_session_id: sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  return !error;
}

export async function updatePrintOrder(
  orderId: string,
  patch: Partial<{
    status: string;
    stripePaymentIntentId: string | null;
    luluPrintJobId: string | null;
    luluJobStatus: string | null;
    trackingUrls: unknown;
    interiorPdfUrl: string | null;
    coverPdfUrl: string | null;
    errorMessage: string | null;
  }>
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.stripePaymentIntentId !== undefined)
    row.stripe_payment_intent_id = patch.stripePaymentIntentId;
  if (patch.luluPrintJobId !== undefined) row.lulu_print_job_id = patch.luluPrintJobId;
  if (patch.luluJobStatus !== undefined) row.lulu_job_status = patch.luluJobStatus;
  if (patch.trackingUrls !== undefined) row.tracking_urls = patch.trackingUrls;
  if (patch.interiorPdfUrl !== undefined) row.interior_pdf_url = patch.interiorPdfUrl;
  if (patch.coverPdfUrl !== undefined) row.cover_pdf_url = patch.coverPdfUrl;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;

  const { error } = await supabase.from("print_orders").update(row).eq("id", orderId);
  return !error;
}

export async function listPrintOrdersForUser(userId: string): Promise<PrintOrderRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((r) => mapPrintOrder(r as Record<string, unknown>));
}

export async function listPrintOrdersAdmin(limit = 100): Promise<PrintOrderRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => mapPrintOrder(r as Record<string, unknown>));
}

export async function listPrintPricingRules(): Promise<PrintPricingRulesRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("print_pricing_rules")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => mapPricing(r as Record<string, unknown>));
}
