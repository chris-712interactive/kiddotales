import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getAllBooksByUserId,
  getUserProfile,
} from "@/lib/db";

const WARNING_DAYS = 30;
const DELETION_DAYS = 90;

export type RetentionNotification = {
  type: "book_inactivity_warning";
  bookId: string;
  bookTitle: string;
  daysSinceOpened: number;
  deletionInDays: number;
};

/** GET: Notifications for the current user (retention warnings, etc.) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ notifications: [] });
  }

  const userId = session.user.id as string;

  try {
    await ensureUser(userId, session.user.email ?? undefined);
    const profile = await getUserProfile(userId);
    const tier = profile?.subscriptionTier ?? "free";

    if (tier !== "free") {
      return NextResponse.json({ notifications: [] });
    }

    const books = await getAllBooksByUserId(userId);
    const now = new Date();
    const notifications: RetentionNotification[] = [];

    for (const book of books) {
      const lastOpened = book.lastOpenedAt
        ? new Date(book.lastOpenedAt)
        : new Date(book.createdAt!);
      const daysSinceOpened = Math.floor(
        (now.getTime() - lastOpened.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceOpened >= WARNING_DAYS) {
        const deletionInDays = Math.max(0, DELETION_DAYS - daysSinceOpened);
        notifications.push({
          type: "book_inactivity_warning",
          bookId: book.id!,
          bookTitle: book.title,
          daysSinceOpened,
          deletionInDays,
        });
      }
    }

    return NextResponse.json({ notifications });
  } catch (e) {
    console.error("GET /api/notifications:", e);
    return NextResponse.json({ notifications: [] });
  }
}
