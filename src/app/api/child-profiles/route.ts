import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getChildProfiles,
  createChildProfile,
  getUserProfile,
} from "@/lib/db";
import { getTierCapabilities } from "@/lib/entitlements";
import type { ChildProfile } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [profiles, profile] = await Promise.all([
    getChildProfiles(userId),
    getUserProfile(userId),
  ]);
  const tier = profile?.subscriptionTier ?? "free";
  const maxChildProfiles = getTierCapabilities(tier).maxChildProfiles;

  return NextResponse.json({
    profiles,
    maxChildProfiles,
    childProfileCount: profiles.length,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, age, pronouns, interests, appearance } =
    body as Partial<ChildProfile>;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const [existing, userProfile] = await Promise.all([
    getChildProfiles(userId),
    getUserProfile(userId),
  ]);
  const maxChildProfiles = getTierCapabilities(
    userProfile?.subscriptionTier ?? "free"
  ).maxChildProfiles;
  if (existing.length >= maxChildProfiles) {
    return NextResponse.json(
      {
        error: `You've reached your plan limit of ${maxChildProfiles} child profile${maxChildProfiles === 1 ? "" : "s"}. Upgrade to add more.`,
      },
      { status: 403 }
    );
  }

  const profile = await createChildProfile(userId, {
    name: name.trim(),
    age: age ?? 5,
    pronouns: pronouns ?? "they/them",
    interests: Array.isArray(interests) ? interests : [],
    appearance: appearance ?? {},
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Failed to create profile." },
      { status: 500 }
    );
  }

  return NextResponse.json(profile);
}
