import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  getActivePrintPricingRules,
  listPrintPricingRules,
  updatePrintPricingRules,
} from "@/lib/print-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await listPrintPricingRules();
  const active = await getActivePrintPricingRules();
  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      markupPercent: r.markupPercent,
      flatFeeCents: r.flatFeeCents,
      minRetailCents: r.minRetailCents,
      maxRetailCents: r.maxRetailCents,
      roundToNineteen: r.roundToNineteen,
    })),
    activeId: active?.id ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    id?: string;
    markupPercent?: number;
    flatFeeCents?: number;
    minRetailCents?: number | null;
    maxRetailCents?: number | null;
    roundToNineteen?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const ok = await updatePrintPricingRules(id, {
    markupPercent: body.markupPercent,
    flatFeeCents: body.flatFeeCents,
    minRetailCents: body.minRetailCents,
    maxRetailCents: body.maxRetailCents,
    roundToNineteen: body.roundToNineteen,
  });

  if (!ok) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const active = await getActivePrintPricingRules();
  return NextResponse.json({ ok: true, active });
}
