import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  updateChildProfile,
  deleteChildProfile,
} from "@/lib/db";
import type { ChildProfile } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Profile ID required" }, { status: 400 });
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

  const updates: Partial<Omit<ChildProfile, "id" | "createdAt" | "updatedAt">> =
    {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) {
    const ageNum = typeof age === "number" ? age : typeof age === "string" ? parseInt(age, 10) : NaN;
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 12) {
      return NextResponse.json(
        { error: "Age must be between 1 and 12." },
        { status: 400 }
      );
    }
    updates.age = ageNum;
  }
  if (pronouns !== undefined) updates.pronouns = pronouns;
  if (interests !== undefined) updates.interests = interests;
  if (appearance !== undefined) updates.appearance = appearance;
  if (appearanceDetailedDescription !== undefined) {
    updates.appearanceDetailedDescription = appearanceDetailedDescription;
  }
  if (appearanceDetailedDescriptionVersion !== undefined) {
    updates.appearanceDetailedDescriptionVersion =
      appearanceDetailedDescriptionVersion;
  }
  if (appearanceDerivedFromPhotoAt !== undefined) {
    updates.appearanceDerivedFromPhotoAt = appearanceDerivedFromPhotoAt;
  }

  const profile = await updateChildProfile(id, session.user.id, updates);
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found or update failed." },
      { status: 404 }
    );
  }

  return NextResponse.json(profile);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Profile ID required" }, { status: 400 });
  }

  const ok = await deleteChildProfile(id, session.user.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Profile not found or delete failed." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
