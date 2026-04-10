import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { deletePrintBookStyle, updatePrintBookStyle } from "@/lib/print-db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updatePrintBookStyle>[1] = {};
  if (typeof body.podPackageId === "string") patch.podPackageId = body.podPackageId;
  if (typeof body.name === "string") patch.name = body.name;
  if (body.description === null || typeof body.description === "string") {
    patch.description = body.description as string | null;
  }
  if (typeof body.trimWidthIn === "number") patch.trimWidthIn = body.trimWidthIn;
  if (typeof body.trimHeightIn === "number") patch.trimHeightIn = body.trimHeightIn;
  if (typeof body.coverBleedIn === "number") patch.coverBleedIn = body.coverBleedIn;
  if (typeof body.coverSafeMarginIn === "number") patch.coverSafeMarginIn = body.coverSafeMarginIn;
  if (body.spineWidthIn === null) patch.spineWidthIn = null;
  else if (typeof body.spineWidthIn === "number") patch.spineWidthIn = body.spineWidthIn;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

  const ok = await updatePrintBookStyle(id, patch);
  if (!ok) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const ok = await deletePrintBookStyle(id);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
