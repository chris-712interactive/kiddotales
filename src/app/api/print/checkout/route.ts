import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { computePrintQuoteForBook } from "@/lib/print-quote";
import {
  createPrintOrder,
  updatePrintOrderStripeSession,
} from "@/lib/print-db";
import { parseShippingAddress, parseShippingOption } from "@/lib/print-address";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  let body: {
    bookId?: string;
    printBookStyleId?: string | null;
    shippingAddress?: unknown;
    shippingOption?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookId = String(body.bookId ?? "").trim();
  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const shippingAddress = parseShippingAddress(body.shippingAddress);
  if (!shippingAddress) {
    return NextResponse.json(
      { error: "Invalid shipping address" },
      { status: 400 }
    );
  }

  const shippingOption = parseShippingOption(body.shippingOption);
  if (!shippingOption) {
    return NextResponse.json({ error: "Invalid shipping option" }, { status: 400 });
  }

  const printBookStyleId =
    typeof body.printBookStyleId === "string" && body.printBookStyleId.trim()
      ? body.printBookStyleId.trim()
      : null;

  const userId = session.user.id as string;
  await ensureUser(userId, session.user.email);

  const quote = await computePrintQuoteForBook({
    userId,
    bookId,
    shippingAddress,
    shippingOption,
    printBookStyleId,
  });

  if (!quote.ok) {
    return NextResponse.json({ error: quote.error }, { status: quote.status });
  }

  if (quote.retailCents < 50) {
    return NextResponse.json(
      { error: "Computed price is too low; check pricing rules" },
      { status: 400 }
    );
  }

  const order = await createPrintOrder({
    userId,
    bookId,
    podPackageId: quote.podPackageId,
    printBookStyleId: quote.printBookStyle.id,
    pageCount: quote.pageCount,
    shippingOption,
    shippingAddress,
    customerEmail: shippingAddress.email ?? null,
    retailAmountCents: quote.retailCents,
    currency: quote.currency,
    wholesaleTotalInclTax: quote.lulu.total_cost_incl_tax ?? null,
    luluCostSnapshot: quote.lulu,
  });

  if (!order) {
    return NextResponse.json(
      { error: "Failed to create print order" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const successUrl = `${baseUrl}/print/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/print/order?bookId=${encodeURIComponent(bookId)}`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: quote.currency.toLowerCase(),
            unit_amount: quote.retailCents,
            product_data: {
              name: `Printed book: ${quote.book.title}`,
              description: `${quote.printBookStyle.name} — print-on-demand`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: "lulu_print",
        printOrderId: order.id,
        userId,
        bookId,
      },
      payment_intent_data: {
        metadata: {
          kind: "lulu_print",
          printOrderId: order.id,
          userId,
          bookId,
        },
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    await updatePrintOrderStripeSession(order.id, checkoutSession.id);

    return NextResponse.json({
      url: checkoutSession.url,
      printOrderId: order.id,
    });
  } catch (err) {
    console.error("[print checkout]", err);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
