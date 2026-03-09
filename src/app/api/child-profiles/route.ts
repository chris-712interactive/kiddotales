import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getChildProfiles,
  createChildProfile,
} from "@/lib/db";
import type { ChildProfile } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await getChildProfiles(session.user.id);
  return NextResponse.json(profiles);
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

  const profile = await createChildProfile(session.user.id, {
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
