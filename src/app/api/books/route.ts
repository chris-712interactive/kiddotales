import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBooksByUserId } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }

  try {
    const books = await getBooksByUserId(session.user.id as string);
    return NextResponse.json(books);
  } catch {
    return NextResponse.json([]);
  }
}
