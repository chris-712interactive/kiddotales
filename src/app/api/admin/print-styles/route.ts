import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  createPrintBookStyle,
  listPrintBookStylesAdmin,
} from "@/lib/print-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const styles = await listPrintBookStylesAdmin();
  return NextResponse.json({
    styles: styles.map((s) => ({
      id: s.id,
      podPackageId: s.podPackageId,
      name: s.name,
      description: s.description,
      trimWidthIn: s.trimWidthIn,
      trimHeightIn: s.trimHeightIn,
      coverBleedIn: s.coverBleedIn,
      coverSafeMarginIn: s.coverSafeMarginIn,
      spineWidthIn: s.spineWidthIn,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      updatedAt: s.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    podPackageId?: string;
    name?: string;
    description?: string | null;
    trimWidthIn?: number;
    trimHeightIn?: number;
    coverBleedIn?: number;
    coverSafeMarginIn?: number;
    spineWidthIn?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const podPackageId = String(body.podPackageId ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!podPackageId || !name) {
    return NextResponse.json(
      { error: "podPackageId and name are required" },
      { status: 400 }
    );
  }

  const trimW = Number(body.trimWidthIn);
  const trimH = Number(body.trimHeightIn);
  if (!Number.isFinite(trimW) || trimW <= 0 || trimW > 24) {
    return NextResponse.json({ error: "Invalid trimWidthIn" }, { status: 400 });
  }
  if (!Number.isFinite(trimH) || trimH <= 0 || trimH > 24) {
    return NextResponse.json({ error: "Invalid trimHeightIn" }, { status: 400 });
  }

  const row = await createPrintBookStyle({
    podPackageId,
    name,
    description: body.description ?? null,
    trimWidthIn: trimW,
    trimHeightIn: trimH,
    coverBleedIn:
      typeof body.coverBleedIn === "number" && Number.isFinite(body.coverBleedIn)
        ? body.coverBleedIn
        : undefined,
    coverSafeMarginIn:
      typeof body.coverSafeMarginIn === "number" && Number.isFinite(body.coverSafeMarginIn)
        ? body.coverSafeMarginIn
        : undefined,
    spineWidthIn:
      typeof body.spineWidthIn === "number" && Number.isFinite(body.spineWidthIn)
        ? body.spineWidthIn
        : body.spineWidthIn === null
          ? null
          : undefined,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });

  if (!row) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  return NextResponse.json({ style: row });
}
