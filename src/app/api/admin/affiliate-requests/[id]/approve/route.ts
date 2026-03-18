import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { approveAffiliateRequest } from "@/lib/affiliates";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing request ID" }, { status: 400 });

  let body: { code?: string; commissionRate?: number; commissionType?: string; recurringRate?: number };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Affiliate code is required" }, { status: 400 });

  const commissionType = body.commissionType as "first_only" | "recurring" | "both" | undefined;
  const result = await approveAffiliateRequest(
    id,
    code,
    body.commissionRate,
    commissionType,
    commissionType === "both" ? body.recurringRate : undefined
  );
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ affiliate: result.affiliate });
}
