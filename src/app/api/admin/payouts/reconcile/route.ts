import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  markAffiliatePendingAsPaid,
  markCommissionsAsPaid,
} from "@/lib/affiliates";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { affiliateId, commissionIds, payoutType } = body as {
      affiliateId?: string;
      commissionIds?: string[];
      payoutType?: string;
    };

    const typeForAccounting = typeof payoutType === "string" ? payoutType.trim() || null : null;

    if (commissionIds?.length) {
      const ids = Array.isArray(commissionIds)
        ? (commissionIds as string[]).filter((id) => typeof id === "string")
        : [];
      const result = await markCommissionsAsPaid(ids, typeForAccounting);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ updated: result.updated });
    }

    if (affiliateId && typeof affiliateId === "string") {
      const result = await markAffiliatePendingAsPaid(affiliateId, typeForAccounting);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ updated: result.updated });
    }

    return NextResponse.json(
      { error: "Provide affiliateId or commissionIds" },
      { status: 400 }
    );
  } catch (e) {
    console.error("POST /api/admin/payouts/reconcile:", e);
    return NextResponse.json({ error: "Failed to reconcile" }, { status: 500 });
  }
}
