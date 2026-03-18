import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { addTaxFormAudit, getTaxFormById } from "@/lib/affiliate-tax-forms";
import { getClientIp } from "@/lib/request-utils";
import { createSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "affiliate-tax-forms";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actorUserId = (session.user as { id?: string })?.id ?? null;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing tax form ID" }, { status: 400 });

  const form = await getTaxFormById(id);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).download(form.storagePath);
  if (error || !data) {
    console.error("storage.download error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }

  await addTaxFormAudit({ taxFormId: id, actorUserId, action: "downloaded", clientIp: getClientIp(request) });

  const filename = (form.originalFilename || "w9.pdf").replace(/[/\\\\]/g, "_");
  return new NextResponse(data, {
    headers: {
      "Content-Type": form.mimeType || "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}

