import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getUserProfile,
  recordParentConsent,
  revokeParentConsent,
} from "@/lib/db";

/** GET: Check if user has given parental consent. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const profile = await getUserProfile(userId);
    return NextResponse.json({
      hasConsent: !!profile?.parentConsentAt,
      consentAt: profile?.parentConsentAt ?? null,
      consentVersion: profile?.parentConsentVersion ?? null,
    });
  } catch (e) {
    console.error("GET /api/user/consent:", e);
    return NextResponse.json(
      { error: "Failed to check consent" },
      { status: 500 }
    );
  }
}

/** POST: Record parental consent. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  let body: { action?: "grant" | "revoke" };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await ensureUser(userId, session.user.email ?? undefined);

    if (body.action === "revoke") {
      await revokeParentConsent(userId);
      return NextResponse.json({ success: true, revoked: true });
    }

    await recordParentConsent(userId);
    return NextResponse.json({ success: true, revoked: false });
  } catch (e) {
    console.error("POST /api/user/consent:", e);
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    );
  }
}
