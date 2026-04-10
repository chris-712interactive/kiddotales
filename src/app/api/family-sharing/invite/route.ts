import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/lib/db";
import {
  createFamilyShareInvite,
  normalizeFamilyInviteEmail,
} from "@/lib/family-sharing";
import { sendFamilyShareInviteEmail } from "@/lib/mailgun";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const userId = session.user.id as string;
  await ensureUser(userId, session.user.email ?? undefined);

  const result = await createFamilyShareInvite(userId, email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const emailed = await sendFamilyShareInviteEmail({
    to: normalizeFamilyInviteEmail(email),
    acceptUrl: result.acceptUrl,
  });

  return NextResponse.json({
    success: true,
    inviteId: result.inviteId,
    acceptUrl: result.acceptUrl,
    emailSent: emailed,
  });
}
