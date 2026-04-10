import { NextResponse } from "next/server";
import { listActivePrintBookStyles } from "@/lib/print-db";

/** Public list of approved print formats (no Lulu SKU exposed). */
export async function GET() {
  try {
    const styles = await listActivePrintBookStyles();
    return NextResponse.json({
      styles: styles.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        trimWidthIn: s.trimWidthIn,
        trimHeightIn: s.trimHeightIn,
        sortOrder: s.sortOrder,
      })),
    });
  } catch {
    return NextResponse.json({ styles: [] });
  }
}
