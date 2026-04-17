import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getChildProfiles,
  createChildProfile,
  getUserProfile,
} from "@/lib/db";
import { getTierCapabilities } from "@/lib/entitlements";
import { resolveFamilyPlanContext } from "@/lib/family-sharing";
import type { ChildProfile } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [profiles, plan, userRow] = await Promise.all([
    getChildProfiles(userId),
    resolveFamilyPlanContext(session.user.id),
    getUserProfile(userId),
  ]);
  const tier = plan.featureTier;
  const caps = getTierCapabilities(tier);
  const maxChildProfiles = caps.maxChildProfiles;

  return NextResponse.json({
    profiles,
    maxChildProfiles,
    childProfileCount: profiles.length,
    photoAppearanceImport: caps.photoAppearanceImport,
    hasParentConsent: !!userRow?.parentConsentAt,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    age,
    pronouns,
    interests,
    appearance,
    appearanceDetailedDescription,
    appearanceDetailedDescriptionVersion,
    appearanceDerivedFromPhotoAt,
  } = body as Partial<ChildProfile>;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  const ageNum = typeof age === "number" ? age : typeof age === "string" ? parseInt(age, 10) : NaN;
  const resolvedAge = Number.isFinite(ageNum) ? ageNum : 5;
  if (resolvedAge < 1 || resolvedAge > 12) {
    return NextResponse.json(
      { error: "Age must be between 1 and 12." },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const [existing, plan] = await Promise.all([
    getChildProfiles(userId),
    resolveFamilyPlanContext(session.user.id),
  ]);
  const maxChildProfiles = getTierCapabilities(plan.featureTier).maxChildProfiles;
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
    age: resolvedAge,
    pronouns: pronouns ?? "they/them",
    interests: Array.isArray(interests) ? interests : [],
    appearance: appearance ?? {},
    appearanceDetailedDescription:
      typeof appearanceDetailedDescription === "string"
        ? appearanceDetailedDescription.trim() || null
        : appearanceDetailedDescription ?? null,
    appearanceDetailedDescriptionVersion:
      typeof appearanceDetailedDescriptionVersion === "string"
        ? appearanceDetailedDescriptionVersion.trim() || "1"
        : undefined,
    appearanceDerivedFromPhotoAt:
      typeof appearanceDerivedFromPhotoAt === "string"
        ? appearanceDerivedFromPhotoAt
        : appearanceDerivedFromPhotoAt ?? undefined,
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Failed to create profile." },
      { status: 500 }
    );
  }

  return NextResponse.json(profile);
}
