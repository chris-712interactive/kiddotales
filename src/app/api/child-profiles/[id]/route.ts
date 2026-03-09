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
  const { name, age, pronouns, interests, appearance } =
    body as Partial<ChildProfile>;

  const updates: Partial<Omit<ChildProfile, "id" | "createdAt" | "updatedAt">> =
    {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = age;
  if (pronouns !== undefined) updates.pronouns = pronouns;
  if (interests !== undefined) updates.interests = interests;
  if (appearance !== undefined) updates.appearance = appearance;

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
