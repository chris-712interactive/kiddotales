import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { addTaxFormAudit, setTaxFormStatus } from "@/lib/affiliate-tax-forms";
import { getClientIp } from "@/lib/request-utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  let body: { status?: "verified" | "rejected"; rejectedReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "verified" && status !== "rejected") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await setTaxFormStatus({
    id,
    status,
    rejectedReason: status === "rejected" ? (body.rejectedReason?.trim() || "Rejected") : null,
  });
  if (!updated) return NextResponse.json({ error: "Failed to update status" }, { status: 500 });

  await addTaxFormAudit({
    taxFormId: id,
    actorUserId,
    action: status === "verified" ? "verified" : "rejected",
    note: status === "rejected" ? updated.rejectedReason : null,
    clientIp: getClientIp(request),
  });

  return NextResponse.json({ ok: true, form: updated });
}

