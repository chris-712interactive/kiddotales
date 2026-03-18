import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserProfile } from "@/lib/db";
import { getAffiliateByCode, setUserReferredBy } from "@/lib/affiliates";

/**
 * Record affiliate attribution for a signed-in user.
 * Call from client when user has affiliate code in storage and is authenticated.
 * Only sets if user doesn't already have referred_by_affiliate_id.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { affiliateCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { affiliateCode } = body;
  if (!affiliateCode?.trim()) {
    return NextResponse.json({ error: "affiliateCode required" }, { status: 400 });
  }

  const userId = session.user.id as string;
  const profile = await getUserProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (profile.referredByAffiliateId) {
    return NextResponse.json({ ok: true, alreadyAttributed: true });
  }

  const affiliate = await getAffiliateByCode(affiliateCode.trim());
  if (!affiliate) {
    return NextResponse.json({ error: "Invalid affiliate code" }, { status: 400 });
  }

  if (affiliate.userId === userId) {
    return NextResponse.json({ ok: true, selfReferral: true });
  }

  const updated = await setUserReferredBy(userId, affiliate.id);
  return NextResponse.json({ ok: updated });
}
