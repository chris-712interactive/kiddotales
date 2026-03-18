import { createSupabaseAdmin } from "./supabase";

export type Affiliate = {
  id: string;
  code: string;
  name: string | null;
  email: string | null;
  userId: string | null;
  active: boolean;
  commissionRate: number;
  commissionType: "first_only" | "recurring" | "both";
  recurringRate: number | null;
  /** PayPal ID for payouts (e.g. email or PayPal Me ID). */
  paypalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AffiliateRequest = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  audienceSize: number;
  pitch: string;
  /** PayPal ID for payouts (collected on application). */
  paypalId: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

export type AffiliateCommission = {
  id: string;
  affiliateId: string;
  userId: string;
  subscriptionId: string;
  invoiceId: string | null;
  amount: number;
  transactionAmount: number;
  type: "first_payment" | "renewal" | "upgrade";
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
  /** Set when status becomes paid (for accounting). */
  paidAt: string | null;
  /** Accounting label for the payout run (e.g. "Monthly - February 2025"). */
  payoutType: string | null;
};

/** Get affiliate by code (active only, for referral lookups). */
export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  if (!code || typeof code !== "string") return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("active", true)
    .single();
  if (error || !data) return null;
  return mapAffiliate(data);
}

/** Get affiliate by user ID (active only). */
export async function getAffiliateByUserId(userId: string): Promise<Affiliate | null> {
  if (!userId) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;
  return mapAffiliate(data);
}

/** Get affiliate by ID. */
export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("affiliates").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapAffiliate(data);
}

/** List active affiliates (admin). Removed affiliates excluded; commission history retained separately. */
export async function listAffiliates(): Promise<Affiliate[]> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("affiliates")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapAffiliate);
}

/** Create affiliate (admin). */
export async function createAffiliate(params: {
  code: string;
  name?: string | null;
  email?: string | null;
  userId?: string | null;
  paypalId?: string | null;
  commissionRate?: number;
  commissionType?: "first_only" | "recurring" | "both";
  recurringRate?: number | null;
}): Promise<Affiliate | null> {
  const supabase = createSupabaseAdmin();
  const code = params.code.trim().toUpperCase();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    code,
    name: params.name ?? null,
    email: params.email ?? null,
    paypal_id: params.paypalId ?? null,
    commission_rate: params.commissionRate ?? 0.1,
    commission_type: params.commissionType ?? "first_only",
    recurring_rate: params.recurringRate ?? null,
    updated_at: now,
  };
  if (params.userId) row.user_id = params.userId;
  const { data, error } = await supabase.from("affiliates").insert(row).select().single();
  if (error) return null;
  return mapAffiliate(data);
}

/** Update affiliate (admin). */
export async function updateAffiliate(
  id: string,
  params: Partial<{
    code: string;
    name: string | null;
    email: string | null;
    paypalId: string | null;
    commissionRate: number;
    commissionType: "first_only" | "recurring" | "both";
    recurringRate: number | null;
  }>
): Promise<Affiliate | null> {
  const supabase = createSupabaseAdmin();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.code !== undefined) updates.code = params.code.trim().toUpperCase();
  if (params.name !== undefined) updates.name = params.name;
  if (params.email !== undefined) updates.email = params.email;
  if (params.paypalId !== undefined) updates.paypal_id = params.paypalId;
  if (params.commissionRate !== undefined) updates.commission_rate = params.commissionRate;
  if (params.commissionType !== undefined) updates.commission_type = params.commissionType;
  if (params.recurringRate !== undefined) updates.recurring_rate = params.recurringRate;

  const { data, error } = await supabase.from("affiliates").update(updates).eq("id", id).select().single();
  if (error) return null;
  return mapAffiliate(data);
}

/** Remove affiliate from program (admin). Soft delete: sets active=false. Commission history retained 7 years for tax purposes. */
export async function deactivateAffiliate(id: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("affiliates")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

/** Compute commission amount for a transaction. */
export function computeCommission(
  affiliate: Affiliate,
  transactionAmountCents: number,
  type: "first_payment" | "renewal" | "upgrade"
): number {
  const dollars = transactionAmountCents / 100;
  let rate: number;
  if (type === "first_payment" || type === "upgrade") {
    rate = affiliate.commissionRate;
  } else {
    if (affiliate.commissionType === "first_only") return 0;
    rate = affiliate.commissionType === "both" && affiliate.recurringRate != null ? affiliate.recurringRate : affiliate.commissionRate;
  }
  return Math.round(dollars * rate * 100) / 100;
}

/** Create commission record. */
export async function createCommission(params: {
  affiliateId: string;
  userId: string;
  subscriptionId: string;
  invoiceId?: string | null;
  amount: number;
  transactionAmount: number;
  type: "first_payment" | "renewal" | "upgrade";
}): Promise<AffiliateCommission | null> {
  const supabase = createSupabaseAdmin();
  const row = {
    affiliate_id: params.affiliateId,
    user_id: params.userId,
    subscription_id: params.subscriptionId,
    invoice_id: params.invoiceId ?? null,
    amount: params.amount,
    transaction_amount: params.transactionAmount,
    type: params.type,
    status: "pending",
  };
  const { data, error } = await supabase.from("affiliate_commissions").insert(row).select().single();
  if (error) return null;
  return mapCommission(data);
}

/** Get commissions (optionally filtered). startDate/endDate are inclusive (YYYY-MM-DD or ISO). */
export async function getCommissions(params?: {
  affiliateId?: string;
  status?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<(AffiliateCommission & { affiliateCode?: string; affiliatePaypalId?: string | null })[]> {
  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("affiliate_commissions")
    .select("*, affiliates!inner(code, paypal_id)")
    .order("created_at", { ascending: false });
  if (params?.affiliateId) query = query.eq("affiliate_id", params.affiliateId);
  if (params?.status) query = query.eq("status", params.status);
  if (params?.startDate) {
    const from = params.startDate.length === 10 ? `${params.startDate}T00:00:00.000Z` : params.startDate;
    query = query.gte("created_at", from);
  }
  if (params?.endDate) {
    const to = params.endDate.length === 10 ? `${params.endDate}T23:59:59.999Z` : params.endDate;
    query = query.lte("created_at", to);
  }
  if (params?.limit) query = query.limit(params.limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const c = mapCommission(r);
    const aff = r.affiliates as { code?: string; paypal_id?: string | null } | null;
    return { ...c, affiliateCode: aff?.code, affiliatePaypalId: aff?.paypal_id ?? null };
  });
}

/** Update commission status (e.g. mark as paid). */
export async function updateCommissionStatus(
  id: string,
  status: "pending" | "paid" | "cancelled"
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("affiliate_commissions").update({ status }).eq("id", id);
  return !error;
}

/** Payout summary for one affiliate (for admin payouts view). */
export type PayoutSummary = {
  affiliate: Affiliate;
  pendingAmount: number;
  paidAmount: number;
  pendingCount: number;
  paidCount: number;
  pendingCommissions: (AffiliateCommission & { affiliateCode?: string })[];
  paidCommissions: (AffiliateCommission & { affiliateCode?: string })[];
};

/** Get payout summary grouped by affiliate (only affiliates with at least one commission). */
export async function getPayoutSummaryByAffiliate(): Promise<PayoutSummary[]> {
  const supabase = createSupabaseAdmin();
  const { data: rows } = await supabase
    .from("affiliate_commissions")
    .select("*, affiliates!inner(id, code, name, email, user_id, active, commission_rate, commission_type, recurring_rate, created_at, updated_at)")
    .order("created_at", { ascending: false });
  if (!rows?.length) return [];

  const byAffiliate = new Map<
    string,
    { affiliate: Affiliate; pending: (AffiliateCommission & { affiliateCode?: string })[]; paid: (AffiliateCommission & { affiliateCode?: string })[] }
  >();
  for (const r of rows) {
    const aff = r.affiliates as Record<string, unknown> | null;
    const affiliate = aff ? mapAffiliate(aff as Parameters<typeof mapAffiliate>[0]) : null;
    if (!affiliate) continue;
    const commission = mapCommission(r);
    const code = (aff as { code?: string })?.code;
    const c = { ...commission, affiliateCode: code };
    if (!byAffiliate.has(affiliate.id)) {
      byAffiliate.set(affiliate.id, { affiliate, pending: [], paid: [] });
    }
    const bucket = byAffiliate.get(affiliate.id)!;
    if (commission.status === "pending") bucket.pending.push(c);
    else if (commission.status === "paid") bucket.paid.push(c);
    // skip cancelled
  }

  return Array.from(byAffiliate.entries()).map(([, v]) => ({
    affiliate: v.affiliate,
    pendingAmount: v.pending.reduce((s, c) => s + c.amount, 0),
    paidAmount: v.paid.reduce((s, c) => s + c.amount, 0),
    pendingCount: v.pending.length,
    paidCount: v.paid.length,
    pendingCommissions: v.pending,
    paidCommissions: v.paid,
  }));
}

/** Mark given commission IDs as paid (only those currently pending). Sets paid_at and payout_type for accounting. */
export async function markCommissionsAsPaid(
  commissionIds: string[],
  payoutType?: string | null
): Promise<{ updated: number; error?: string }> {
  if (!commissionIds.length) return { updated: 0 };
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update({
      status: "paid",
      paid_at: now,
      payout_type: payoutType ?? null,
    })
    .in("id", commissionIds)
    .eq("status", "pending")
    .select("id");
  if (error) return { updated: 0, error: error.message };
  return { updated: data?.length ?? 0 };
}

/** Mark all pending commissions for an affiliate as paid (reconcile payout). */
export async function markAffiliatePendingAsPaid(
  affiliateId: string,
  payoutType?: string | null
): Promise<{ updated: number; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: pending } = await supabase
    .from("affiliate_commissions")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("status", "pending");
  const ids = (pending ?? []).map((r) => r.id);
  return markCommissionsAsPaid(ids, payoutType);
}

/** Get counts of referred users by subscription tier (for affiliate dashboard). */
export async function getReferredUserCountsByTier(affiliateId: string): Promise<Record<string, number>> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("referred_by_affiliate_id", affiliateId);
  const counts: Record<string, number> = { free: 0, spark: 0, magic: 0, legend: 0 };
  for (const row of data ?? []) {
    const tier = (row.subscription_tier as string) ?? "free";
    if (tier in counts) counts[tier] += 1;
    else counts[tier] = 1;
  }
  return counts;
}

/** Set user's referred_by_affiliate_id. */
export async function setUserReferredBy(userId: string, affiliateId: string | null): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("users")
    .update({ referred_by_affiliate_id: affiliateId, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

/** Check if a commission already exists for this subscription + type (avoid duplicates). */
export async function hasCommissionForSubscription(
  subscriptionId: string,
  type: "first_payment" | "renewal" | "upgrade",
  invoiceId?: string | null
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("affiliate_commissions")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("type", type);
  if ((type === "renewal" || type === "upgrade") && invoiceId) {
    query = query.eq("invoice_id", invoiceId);
  }
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

/** Create affiliate request (authenticated user). */
export async function createAffiliateRequest(params: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  audienceSize: number;
  pitch: string;
  paypalId?: string | null;
}): Promise<AffiliateRequest | null> {
  const supabase = createSupabaseAdmin();
  const row = {
    user_id: params.userId,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    email: params.email.trim().toLowerCase(),
    audience_size: Math.max(0, Math.floor(Number(params.audienceSize) || 0)),
    pitch: String(params.pitch || "").trim(),
    paypal_id: params.paypalId?.trim() || null,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("affiliate_requests").insert(row).select().single();
  if (error) return null;
  return mapAffiliateRequest(data);
}

/** Get affiliate request by user ID (most recent). */
export async function getAffiliateRequestByUserId(userId: string): Promise<AffiliateRequest | null> {
  if (!userId) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliate_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return mapAffiliateRequest(data);
}

/** List affiliate requests (admin). When status is pending, excludes requests whose user is already an active affiliate. */
export async function listAffiliateRequests(params?: {
  status?: "pending" | "approved" | "rejected";
}): Promise<AffiliateRequest[]> {
  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("affiliate_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (params?.status) query = query.eq("status", params.status);
  const { data } = await query;
  const requests = (data ?? []).map(mapAffiliateRequest);

  if (params?.status !== "pending" || requests.length === 0) return requests;

  const userIds = [...new Set(requests.map((r) => r.userId))];
  const { data: existingAffiliates } = await supabase
    .from("affiliates")
    .select("user_id")
    .eq("active", true)
    .in("user_id", userIds);
  const affiliateUserIds = new Set(
    (existingAffiliates ?? []).map((r) => r.user_id).filter(Boolean)
  );
  return requests.filter((r) => !affiliateUserIds.has(r.userId));
}

/** Approve affiliate request: create affiliate and update request status. */
export async function approveAffiliateRequest(
  requestId: string,
  code: string,
  commissionRate?: number,
  commissionType?: "first_only" | "recurring" | "both",
  recurringRate?: number | null
): Promise<{ affiliate: Affiliate | null; error?: string }> {
  const supabase = createSupabaseAdmin();
  const { data: req } = await supabase.from("affiliate_requests").select("*").eq("id", requestId).eq("status", "pending").single();
  if (!req) return { affiliate: null, error: "Request not found or already processed" };

  const codeTrimmed = code.trim().toUpperCase();
  if (!codeTrimmed) return { affiliate: null, error: "Code is required" };

  const { data: existing } = await supabase.from("affiliates").select("id").eq("code", codeTrimmed).single();
  if (existing) return { affiliate: null, error: "Affiliate code already in use" };

  const name = `${(req.first_name || "").trim()} ${(req.last_name || "").trim()}`.trim() || null;
  const affiliate = await createAffiliate({
    code: codeTrimmed,
    name,
    email: req.email || null,
    userId: req.user_id,
    paypalId: (req as { paypal_id?: string | null }).paypal_id ?? null,
    commissionRate: commissionRate ?? 0.1,
    commissionType: commissionType ?? "first_only",
    recurringRate: commissionType === "both" ? (recurringRate ?? 0.05) : null,
  });
  if (!affiliate) return { affiliate: null, error: "Failed to create affiliate" };

  await supabase
    .from("affiliate_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", requestId);
  return { affiliate };
}

/** Reject affiliate request. */
export async function rejectAffiliateRequest(requestId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("affiliate_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  return !error;
}

function mapAffiliateRequest(r: Record<string, unknown>): AffiliateRequest {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    firstName: (r.first_name as string) ?? "",
    lastName: (r.last_name as string) ?? "",
    email: (r.email as string) ?? "",
    audienceSize: Number(r.audience_size) ?? 0,
    pitch: (r.pitch as string) ?? "",
    paypalId: (r.paypal_id as string) ?? null,
    status: (r.status as "pending" | "approved" | "rejected") ?? "pending",
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? (r.created_at as string),
  };
}

function mapAffiliate(r: Record<string, unknown>): Affiliate {
  return {
    id: r.id as string,
    code: r.code as string,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    userId: (r.user_id as string) ?? null,
    active: r.active !== false,
    commissionRate: Number(r.commission_rate) ?? 0.1,
    commissionType: (r.commission_type as "first_only" | "recurring" | "both") ?? "first_only",
    recurringRate: r.recurring_rate != null ? Number(r.recurring_rate) : null,
    paypalId: (r.paypal_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? r.created_at as string,
  };
}

function mapCommission(r: Record<string, unknown>): AffiliateCommission {
  return {
    id: r.id as string,
    affiliateId: r.affiliate_id as string,
    userId: r.user_id as string,
    subscriptionId: r.subscription_id as string,
    invoiceId: (r.invoice_id as string) ?? null,
    amount: Number(r.amount) ?? 0,
    transactionAmount: Number(r.transaction_amount) ?? 0,
    type: r.type as "first_payment" | "renewal" | "upgrade",
    status: (r.status as "pending" | "paid" | "cancelled") ?? "pending",
    createdAt: r.created_at as string,
    paidAt: (r.paid_at as string) ?? null,
    payoutType: (r.payout_type as string) ?? null,
  };
}
