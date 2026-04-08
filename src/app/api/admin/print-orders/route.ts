import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { listPrintOrdersAdmin } from "@/lib/print-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await listPrintOrdersAdmin(200);
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      bookId: o.bookId,
      printBookStyleId: o.printBookStyleId,
      podPackageId: o.podPackageId,
      status: o.status,
      retailAmountCents: o.retailAmountCents,
      currency: o.currency,
      wholesaleTotalInclTax: o.wholesaleTotalInclTax,
      luluPrintJobId: o.luluPrintJobId,
      luluJobStatus: o.luluJobStatus,
      stripeCheckoutSessionId: o.stripeCheckoutSessionId,
      createdAt: o.createdAt,
      errorMessage: o.errorMessage,
      trackingUrls: o.trackingUrls,
    })),
  });
}
