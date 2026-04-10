import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserProfile, listPurchasedGiftMemberships } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { listPrintOrdersForUser } from "@/lib/print-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  try {
    const [profile, printOrders, gifts] = await Promise.all([
      getUserProfile(userId),
      listPrintOrdersForUser(userId),
      listPurchasedGiftMemberships(userId),
    ]);

    const invoices: Array<{
      id: string;
      createdAt: string;
      amountPaidCents: number;
      currency: string;
      status: string | null;
      number: string | null;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
      billingReason: string | null;
    }> = [];

    const stripe = getStripe();
    if (stripe && profile?.stripeCustomerId) {
      const stripeInvoices = await stripe.invoices.list({
        customer: profile.stripeCustomerId,
        limit: 25,
      });

      for (const inv of stripeInvoices.data) {
        invoices.push({
          id: inv.id,
          createdAt: new Date(inv.created * 1000).toISOString(),
          amountPaidCents: inv.amount_paid ?? 0,
          currency: inv.currency ?? "usd",
          status: inv.status ?? null,
          number: inv.number ?? null,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
          billingReason: inv.billing_reason ?? null,
        });
      }
    }

    return NextResponse.json({
      invoices,
      printOrders: printOrders.map((o) => ({
        id: o.id,
        status: o.status,
        luluJobStatus: o.luluJobStatus,
        retailAmountCents: o.retailAmountCents,
        currency: o.currency,
        createdAt: o.createdAt,
      })),
      gifts: gifts.map((g) => ({
        id: g.id,
        code: g.code,
        tier: g.tier,
        durationMonths: g.durationMonths,
        status: g.status,
        recipientEmail: g.recipientEmail,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    console.error("[Purchases history]", err);
    return NextResponse.json(
      { error: "Failed to load purchase history" },
      { status: 500 }
    );
  }
}
