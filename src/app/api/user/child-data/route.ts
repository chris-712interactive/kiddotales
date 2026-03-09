import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getBooksByUserId,
  getAllBooksByUserId,
  getUserProfile,
  deleteAllUserChildData,
} from "@/lib/db";
import { deleteUserBookStorage } from "@/lib/supabase-storage";

/** GET: List child data (books) for parent access. ?all=true returns all books (for manage page). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const profile = await getUserProfile(userId);
    const tier = profile?.subscriptionTier ?? "free";
    const books = all
      ? await getAllBooksByUserId(userId)
      : await getBooksByUserId(userId, tier);

    return NextResponse.json({
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        createdAt: b.createdAt,
        coverImageUrl: b.coverImageUrl,
        lastOpenedAt: (b as { lastOpenedAt?: string | null }).lastOpenedAt ?? null,
      })),
    });
  } catch (e) {
    console.error("GET /api/user/child-data:", e);
    return NextResponse.json(
      { error: "Failed to load child data" },
      { status: 500 }
    );
  }
}

/** DELETE: Delete all child data (books, images). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  try {
    await ensureUser(userId, session.user.email ?? undefined);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await deleteUserBookStorage(userId);
    }
    const { deletedBooks } = await deleteAllUserChildData(userId);

    return NextResponse.json({
      success: true,
      deletedBooks,
    });
  } catch (e) {
    console.error("DELETE /api/user/child-data:", e);
    return NextResponse.json(
      { error: "Failed to delete child data" },
      { status: 500 }
    );
  }
}
