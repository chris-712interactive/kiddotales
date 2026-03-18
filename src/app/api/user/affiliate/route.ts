import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAffiliateByUserId, getCommissions, getReferredUserCountsByTier } from "@/lib/affiliates";
import { getAffiliateTaxFormForYear } from "@/lib/affiliate-tax-forms";

/** GET: Affiliate dashboard data for the current user (link + commissions). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const affiliate = await getAffiliateByUserId(userId);
  if (!affiliate) {
    return NextResponse.json({ affiliate: null, commissions: [] });
  }

  const [commissions, referredByTier] = await Promise.all([
    getCommissions({ affiliateId: affiliate.id, limit: 200 }),
    getReferredUserCountsByTier(affiliate.id),
  ]);

  const currentYear = new Date().getFullYear();
  const w9 = await getAffiliateTaxFormForYear({ affiliateId: affiliate.id, year: currentYear });

  return NextResponse.json({
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      name: affiliate.name,
      commissionRate: affiliate.commissionRate,
      commissionType: affiliate.commissionType,
    },
    taxForm: {
      year: currentYear,
      hasW9OnFile: !!w9,
      status: w9?.status ?? null,
      uploadedAt: w9?.uploadedAt ?? null,
      source: w9?.source ?? null,
      signedAt: w9?.signedAt ?? null,
    },
    referredByTier,
    commissions: commissions.map((c) => ({
      id: c.id,
      type: c.type,
      amount: c.amount,
      transactionAmount: c.transactionAmount,
      status: c.status,
      createdAt: c.createdAt,
    })),
  });
}
