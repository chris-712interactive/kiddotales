import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureUser,
  getAllBooksByUserId,
  getUserProfile,
} from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

const WARNING_DAYS = 30;
const DELETION_DAYS = 90;

export type RetentionNotification = {
  type: "book_inactivity_warning";
  bookId: string;
  bookTitle: string;
  daysSinceOpened: number;
  deletionInDays: number;
};

export type FeedbackNotification = {
  type: "feedback_reply";
  ticketId: string;
  category: string | null;
  createdAt: string;
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

    const books = tier === "free" ? await getAllBooksByUserId(userId) : [];
    const now = new Date();
    const notifications: Array<RetentionNotification | FeedbackNotification> = [];

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

    const { data: unreadFeedback } = await createSupabaseAdmin()
      .from("feedback")
      .select("id, category, updated_at")
      .eq("user_id", userId)
      .eq("unread_for_user", true)
      .order("updated_at", { ascending: false })
      .limit(20);

    for (const row of unreadFeedback ?? []) {
      notifications.push({
        type: "feedback_reply",
        ticketId: row.id as string,
        category: (row.category as string | null) ?? null,
        createdAt: (row.updated_at as string) ?? new Date().toISOString(),
      });
    }

    return NextResponse.json({ notifications });
  } catch (e) {
    console.error("GET /api/notifications:", e);
    return NextResponse.json({ notifications: [] });
  }
}
