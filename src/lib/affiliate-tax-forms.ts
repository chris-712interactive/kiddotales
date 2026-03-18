import { createSupabaseAdmin } from "./supabase";

export type AffiliateTaxFormStatus = "submitted" | "verified" | "rejected";

export type AffiliateTaxForm = {
  id: string;
  affiliateId: string;
  storagePath: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number | null;
  sha256: string | null;
  year: number | null;
  source: "electronic" | "uploaded";
  signedAt: string | null;
  status: AffiliateTaxFormStatus;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectedReason: string | null;
  createdByUserId: string | null;
};

export type AffiliateTaxFormAudit = {
  id: string;
  taxFormId: string;
  actorUserId: string | null;
  action: "uploaded" | "downloaded" | "verified" | "rejected";
  note: string | null;
  clientIp: string | null;
  createdAt: string;
};

function mapTaxForm(r: Record<string, unknown>): AffiliateTaxForm {
  return {
    id: r.id as string,
    affiliateId: r.affiliate_id as string,
    storagePath: r.storage_path as string,
    originalFilename: (r.original_filename as string) ?? null,
    mimeType: (r.mime_type as string) ?? "application/pdf",
    sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
    sha256: (r.sha256 as string) ?? null,
    year: r.year != null ? Number(r.year) : null,
    source: (r.source as "electronic" | "uploaded") ?? "uploaded",
    signedAt: (r.signed_at as string) ?? null,
    status: (r.status as AffiliateTaxFormStatus) ?? "submitted",
    uploadedAt: r.uploaded_at as string,
    verifiedAt: (r.verified_at as string) ?? null,
    rejectedReason: (r.rejected_reason as string) ?? null,
    createdByUserId: (r.created_by_user_id as string) ?? null,
  };
}

function mapAudit(r: Record<string, unknown>): AffiliateTaxFormAudit {
  return {
    id: r.id as string,
    taxFormId: r.tax_form_id as string,
    actorUserId: (r.actor_user_id as string) ?? null,
    action: r.action as AffiliateTaxFormAudit["action"],
    note: (r.note as string) ?? null,
    clientIp: (r.client_ip as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export type CreateTaxFormResult =
  | { form: AffiliateTaxForm; error?: undefined }
  | { form: null; error: string };

export async function createTaxFormMetadata(params: {
  affiliateId: string;
  storagePath: string;
  originalFilename?: string | null;
  mimeType: string;
  sizeBytes?: number | null;
  sha256?: string | null;
  year?: number | null;
  source?: "electronic" | "uploaded";
  signedAt?: string | null;
  createdByUserId?: string | null;
}): Promise<CreateTaxFormResult> {
  const supabase = createSupabaseAdmin();
  const row = {
    affiliate_id: params.affiliateId,
    storage_path: params.storagePath,
    original_filename: params.originalFilename ?? null,
    mime_type: params.mimeType,
    size_bytes: params.sizeBytes ?? null,
    sha256: params.sha256 ?? null,
    year: params.year ?? null,
    source: params.source ?? "uploaded",
    signed_at: params.signedAt ?? null,
    status: "submitted",
    created_by_user_id: params.createdByUserId ?? null,
  };
  const { data, error } = await supabase.from("affiliate_tax_forms").insert(row).select("*").single();
  if (error) {
    const msg = error.message ?? String(error);
    return { form: null, error: msg };
  }
  if (!data) return { form: null, error: "No data returned" };
  return { form: mapTaxForm(data) };
}

/** Replace the W-9 for an affiliate for a given year (same calendar year). Resets status to submitted. */
export async function replaceTaxFormForYear(params: {
  affiliateId: string;
  year: number;
  storagePath: string;
  originalFilename?: string | null;
  mimeType: string;
  sizeBytes?: number | null;
  sha256?: string | null;
  source?: "electronic" | "uploaded";
  signedAt?: string | null;
  createdByUserId?: string | null;
}): Promise<AffiliateTaxForm | null> {
  const existing = await getAffiliateTaxFormForYear({ affiliateId: params.affiliateId, year: params.year });
  if (!existing) return null;

  const supabase = createSupabaseAdmin();
  const updates = {
    storage_path: params.storagePath,
    original_filename: params.originalFilename ?? null,
    mime_type: params.mimeType,
    size_bytes: params.sizeBytes ?? null,
    sha256: params.sha256 ?? null,
    source: params.source ?? "uploaded",
    signed_at: params.signedAt ?? null,
    status: "submitted",
    verified_at: null,
    rejected_reason: null,
    uploaded_at: new Date().toISOString(),
    created_by_user_id: params.createdByUserId ?? null,
  };
  const { data, error } = await supabase
    .from("affiliate_tax_forms")
    .update(updates)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapTaxForm(data);
}

export async function addTaxFormAudit(params: {
  taxFormId: string;
  actorUserId?: string | null;
  action: AffiliateTaxFormAudit["action"];
  note?: string | null;
  clientIp?: string | null;
}): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const row = {
    tax_form_id: params.taxFormId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    note: params.note ?? null,
    client_ip: params.clientIp ?? null,
  };
  const { error } = await supabase.from("affiliate_tax_form_audit").insert(row);
  return !error;
}

export async function listAffiliateTaxFormsForAdmin(params?: {
  status?: AffiliateTaxFormStatus;
  month?: string; // YYYY-MM based on uploaded_at
  limit?: number;
}): Promise<(AffiliateTaxForm & { affiliateCode?: string; affiliateName?: string | null; affiliateEmail?: string | null })[]> {
  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("affiliate_tax_forms")
    .select("*, affiliates!inner(code, name, email)")
    .order("uploaded_at", { ascending: false });
  if (params?.status) query = query.eq("status", params.status);
  if (params?.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const start = `${params.month}-01T00:00:00.000Z`;
    const [y, m] = params.month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const end = `${params.month}-${String(last).padStart(2, "0")}T23:59:59.999Z`;
    query = query.gte("uploaded_at", start).lte("uploaded_at", end);
  }
  if (params?.limit) query = query.limit(params.limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const f = mapTaxForm(r);
    const aff = r.affiliates as { code?: string; name?: string | null; email?: string | null } | null;
    return { ...f, affiliateCode: aff?.code, affiliateName: aff?.name ?? null, affiliateEmail: aff?.email ?? null };
  });
}

export async function getAffiliateTaxFormForYear(params: {
  affiliateId: string;
  year: number;
}): Promise<AffiliateTaxForm | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliate_tax_forms")
    .select("*")
    .eq("affiliate_id", params.affiliateId)
    .eq("year", params.year)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapTaxForm(data);
}

export async function getTaxFormById(id: string): Promise<AffiliateTaxForm | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("affiliate_tax_forms").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapTaxForm(data);
}

export async function setTaxFormStatus(params: {
  id: string;
  status: AffiliateTaxFormStatus;
  rejectedReason?: string | null;
}): Promise<AffiliateTaxForm | null> {
  const supabase = createSupabaseAdmin();
  const updates: Record<string, unknown> = { status: params.status };
  if (params.status === "verified") {
    updates.verified_at = new Date().toISOString();
    updates.rejected_reason = null;
  }
  if (params.status === "rejected") {
    updates.verified_at = null;
    updates.rejected_reason = params.rejectedReason ?? "Rejected";
  }
  const { data, error } = await supabase.from("affiliate_tax_forms").update(updates).eq("id", params.id).select("*").single();
  if (error || !data) return null;
  return mapTaxForm(data);
}

