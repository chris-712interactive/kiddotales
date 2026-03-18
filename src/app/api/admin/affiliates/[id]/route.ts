import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { updateAffiliate, deactivateAffiliate } from "@/lib/affiliates";

export async function DELETE(
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
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const ok = await deactivateAffiliate(id);
  if (!ok) return NextResponse.json({ error: "Failed to remove affiliate" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
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
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    const body = await request.json();
    const { code, name, email, commissionRate, commissionType, recurringRate } = body as {
      code?: string;
      name?: string;
      email?: string;
      commissionRate?: number;
      commissionType?: "first_only" | "recurring" | "both";
      recurringRate?: number;
    };
    const affiliate = await updateAffiliate(id, {
      code: code?.trim(),
      name: name !== undefined ? (name?.trim() || null) : undefined,
      email: email !== undefined ? (email?.trim() || null) : undefined,
      commissionRate,
      commissionType,
      recurringRate: recurringRate !== undefined ? recurringRate : undefined,
    });
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }
    return NextResponse.json({ affiliate });
  } catch (e) {
    console.error("PATCH /api/admin/affiliates/[id]:", e);
    return NextResponse.json({ error: "Failed to update affiliate" }, { status: 500 });
  }
}
