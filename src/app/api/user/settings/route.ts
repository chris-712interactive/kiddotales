import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getUserProfile,
  updateUserProfile,
  getUserBookCountByPeriod,
  getBookLimitForUser,
} from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const [profile, limitConfig] = await Promise.all([
      getUserProfile(userId),
      getBookLimitForUser(userId),
    ]);

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const bookCount = await getUserBookCountByPeriod(userId, limitConfig.period);

    return NextResponse.json({
      profile: {
        ...profile,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      },
      bookCount,
      bookLimit: limitConfig.limit,
      bookLimitPeriod: limitConfig.period,
      subscriptionTier: profile.subscriptionTier,
      theme: profile.theme,
    });
  } catch (e) {
    console.error("GET /api/user/settings:", e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  let body: {
    displayName?: string | null;
    phone?: string | null;
    theme?: "light" | "dark";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const updated = await updateUserProfile(userId, {
      displayName: body.displayName,
      phone: body.phone,
      theme: body.theme,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: updated });
  } catch (e) {
    console.error("PATCH /api/user/settings:", e);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
