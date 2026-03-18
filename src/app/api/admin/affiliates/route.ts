import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAffiliates, createAffiliate } from "@/lib/affiliates";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const affiliates = await listAffiliates();
    return NextResponse.json({ affiliates });
  } catch (e) {
    console.error("GET /api/admin/affiliates:", e);
    return NextResponse.json({ error: "Failed to load affiliates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { code, name, email, paypalId, commissionRate, commissionType, recurringRate } = body as {
      code?: string;
      name?: string;
      email?: string;
      paypalId?: string;
      commissionRate?: number;
      commissionType?: "first_only" | "recurring" | "both";
      recurringRate?: number;
    };
    if (!code?.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const affiliate = await createAffiliate({
      code: code.trim(),
      name: name?.trim() || null,
      email: email?.trim() || null,
      paypalId: paypalId?.trim() || null,
      commissionRate: typeof commissionRate === "number" ? commissionRate : undefined,
      commissionType: commissionType || undefined,
      recurringRate: typeof recurringRate === "number" ? recurringRate : undefined,
    });
    if (!affiliate) {
      return NextResponse.json({ error: "Failed to create affiliate (code may already exist)" }, { status: 400 });
    }
    return NextResponse.json({ affiliate });
  } catch (e) {
    console.error("POST /api/admin/affiliates:", e);
    return NextResponse.json({ error: "Failed to create affiliate" }, { status: 500 });
  }
}
