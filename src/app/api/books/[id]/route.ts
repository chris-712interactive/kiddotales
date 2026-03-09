import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookById, deleteBook } from "@/lib/db";
import { deleteBookStorage } from "@/lib/supabase-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Book ID required" }, { status: 400 });
  }

  const book = await getBookById(id, session.user.id);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ ...book, id });
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
    return NextResponse.json({ error: "Book ID required" }, { status: 400 });
  }

  const book = await getBookById(id, session.user.id);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await deleteBookStorage(id);
    }
    const deleted = await deleteBook(id, session.user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/books/[id]:", e);
    return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
  }
}
