import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserProfile } from "@/lib/db";
import {
  getAffiliateByUserId,
  getAffiliateRequestByUserId,
  createAffiliateRequest,
} from "@/lib/affiliates";

/** GET: Check user's affiliate/request status. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const [affiliate, request] = await Promise.all([
    getAffiliateByUserId(userId),
    getAffiliateRequestByUserId(userId),
  ]);

  if (affiliate) {
    return NextResponse.json({ status: "affiliate", affiliate: { code: affiliate.code } });
  }
  if (request) {
    return NextResponse.json({ status: "request", request: { status: request.status } });
  }
  return NextResponse.json({ status: "none" });
}

/** POST: Submit affiliate request (requires KiddoTales account). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to apply" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const profile = await getUserProfile(userId);
  if (!profile) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const affiliate = await getAffiliateByUserId(userId);
  if (affiliate) {
    return NextResponse.json({ error: "You are already an affiliate" }, { status: 400 });
  }

  const existing = await getAffiliateRequestByUserId(userId);
  if (existing?.status === "pending") {
    return NextResponse.json({ error: "You already have a pending application" }, { status: 400 });
  }
  if (existing?.status === "approved") {
    return NextResponse.json({ error: "You are already an affiliate" }, { status: 400 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    audienceSize?: number;
    pitch?: string;
    paypalId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const audienceSize = Math.max(0, Math.floor(Number(body.audienceSize) || 0));
  const pitch = String(body.pitch ?? "").trim();
  const paypalId = String(body.paypalId ?? "").trim() || undefined;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!pitch || pitch.length < 50) {
    return NextResponse.json({ error: "Please write at least 50 characters explaining why you'd be a good fit" }, { status: 400 });
  }

  const accountEmail = (profile.email ?? "").toLowerCase();
  if (email !== accountEmail) {
    return NextResponse.json(
      { error: "Email must match your KiddoTales account email" },
      { status: 400 }
    );
  }

  const req = await createAffiliateRequest({
    userId,
    firstName,
    lastName,
    email,
    audienceSize,
    pitch,
    paypalId: paypalId ?? null,
  });
  if (!req) return NextResponse.json({ error: "Failed to submit" }, { status: 500 });

  return NextResponse.json({ ok: true, request: { id: req.id } });
}
