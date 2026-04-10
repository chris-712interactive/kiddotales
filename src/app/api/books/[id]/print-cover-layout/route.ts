import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookById, updateBookCreationMetadata } from "@/lib/db";
import type { PrintCoverTitleLayout } from "@/types";

function parseLayout(input: unknown): PrintCoverTitleLayout | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const x = Number(obj.x);
  const y = Number(obj.y);
  const width = Number(obj.width);
  const fontSizePt = Number(obj.fontSizePt);
  const align = String(obj.align || "");
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(fontSizePt)) {
    return null;
  }
  if (!["left", "center", "right"].includes(align)) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width: Math.min(0.95, Math.max(0.35, width)),
    fontSizePt: Math.min(64, Math.max(16, fontSizePt)),
    align: align as PrintCoverTitleLayout["align"],
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Book ID required" }, { status: 400 });

  let body: { layout?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const layout = parseLayout(body.layout);
  if (!layout) return NextResponse.json({ error: "Invalid layout payload" }, { status: 400 });

  const book = await getBookById(id, session.user.id);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const metadata = {
    ...(book.creationMetadata || {}),
    printCoverTitleLayout: layout,
  };
  const ok = await updateBookCreationMetadata(id, session.user.id, metadata as never);
  if (!ok) return NextResponse.json({ error: "Failed to save layout" }, { status: 500 });

  return NextResponse.json({ ok: true, printCoverTitleLayout: layout });
}

