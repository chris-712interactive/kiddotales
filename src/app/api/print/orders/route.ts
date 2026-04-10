import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPrintOrdersForUser } from "@/lib/print-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await listPrintOrdersForUser(session.user.id as string);
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      bookId: o.bookId,
      printBookStyleId: o.printBookStyleId,
      status: o.status,
      retailAmountCents: o.retailAmountCents,
      currency: o.currency,
      luluPrintJobId: o.luluPrintJobId,
      luluJobStatus: o.luluJobStatus,
      trackingUrls: o.trackingUrls,
      createdAt: o.createdAt,
      errorMessage: o.errorMessage,
    })),
  });
}
