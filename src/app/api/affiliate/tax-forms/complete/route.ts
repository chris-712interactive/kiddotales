import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAffiliateByUserId } from "@/lib/affiliates";
import { addTaxFormAudit, createTaxFormMetadata } from "@/lib/affiliate-tax-forms";
import { getClientIp } from "@/lib/request-utils";

const BUCKET_PREFIX = "affiliate/";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const affiliate = await getAffiliateByUserId(userId);
  if (!affiliate) {
    return NextResponse.json({ error: "Not an affiliate" }, { status: 403 });
  }

  let body: {
    path?: string;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
    year?: number;
    source?: "electronic" | "uploaded";
    signedAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const path = String(body.path ?? "").trim();
  const originalFilename = String(body.originalFilename ?? "").trim() || null;
  const mimeType = String(body.mimeType ?? "application/pdf").trim();
  const sizeBytes = body.sizeBytes != null ? Number(body.sizeBytes) : null;
  const sha256 = String(body.sha256 ?? "").trim() || null;
  const year = body.year != null ? Number(body.year) : null;
  const source = body.source === "electronic" ? "electronic" : "uploaded";
  const signedAt = source === "electronic" ? (String(body.signedAt ?? "").trim() || null) : null;

  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  if (!path.startsWith(`${BUCKET_PREFIX}${affiliate.id}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 });
  }
  if (year != null && (!Number.isFinite(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (signedAt && Number.isNaN(Date.parse(signedAt))) {
    return NextResponse.json({ error: "Invalid signedAt" }, { status: 400 });
  }

  const result = await createTaxFormMetadata({
    affiliateId: affiliate.id,
    storagePath: path,
    originalFilename,
    mimeType,
    sizeBytes,
    sha256,
    year,
    source,
    signedAt,
    createdByUserId: userId,
  });

  if (!result.form) {
    const err = result.error ?? "Failed to save metadata";
    const isDuplicate =
      /unique|duplicate key|affiliate_tax_forms_affiliate_year/i.test(err);
    if (isDuplicate) {
      return NextResponse.json(
        { error: "A W-9 for this year has already been submitted. Use the existing form or contact support to replace it." },
        { status: 409 }
      );
    }
    console.error("tax-forms/complete createTaxFormMetadata failed:", err);
    return NextResponse.json(
      {
        error: "Failed to save metadata",
        ...(process.env.NODE_ENV === "development" && { detail: err }),
      },
      { status: 500 }
    );
  }

  const clientIp = getClientIp(request);
  await addTaxFormAudit({ taxFormId: result.form.id, actorUserId: userId, action: "uploaded", clientIp });

  return NextResponse.json({ ok: true, form: result.form });
}

