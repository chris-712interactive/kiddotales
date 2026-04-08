import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getTierFromPriceId, getStripeWebhookSecret } from "@/lib/stripe";
import {
  createGiftMembershipFromCheckout,
  updateSubscriptionFromStripe,
  getUserProfile,
} from "@/lib/db";
import { sendGiftMembershipEmails } from "@/lib/mailgun";
import {
  getAffiliateByCode,
  getAffiliateById,
  computeCommission,
  createCommission,
  setUserReferredBy,
  hasCommissionForSubscription,
} from "@/lib/affiliates";
import {
  getPrintOrderById,
  getPrintOrderByStripeSession,
  updatePrintOrder,
} from "@/lib/print-db";
import { fulfillPrintOrderToLulu } from "@/lib/print-fulfillment";

/** Stripe webhook handler. Must use raw body for signature verification. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    console.error("[Stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[Stripe webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Gift purchase flow (one-time payment)
        if (session.mode === "payment" && session.metadata?.kind === "gift_membership") {
          const tier = session.metadata.tier as "spark" | "magic" | "legend" | undefined;
          if (!tier || !["spark", "magic", "legend"].includes(tier)) break;
          const durationMonths = Number(session.metadata.durationMonths || "1");
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null;

          const gift = await createGiftMembershipFromCheckout({
            purchaserUserId: session.metadata.purchaserUserId ?? null,
            purchaserEmail: session.metadata.purchaserEmail ?? null,
            recipientEmail: session.metadata.recipientEmail ?? null,
            tier,
            durationMonths: Number.isFinite(durationMonths) ? durationMonths : 1,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          });
          if (gift) {
            // Email failures should not fail Stripe webhook processing.
            await sendGiftMembershipEmails({
              purchaserEmail: gift.purchaserEmail,
              recipientEmail: gift.recipientEmail,
              giftCode: gift.code,
              tier: gift.tier,
              durationMonths: gift.durationMonths,
            });
          }
          break;
        }

        // Lulu print-on-demand (one-time payment)
        if (session.mode === "payment" && session.metadata?.kind === "lulu_print") {
          const printOrderId = session.metadata.printOrderId;
          const userId = session.metadata.userId;
          if (!printOrderId || !userId) {
            console.warn("[Stripe webhook] lulu_print: missing printOrderId or userId");
            break;
          }

          const order = await getPrintOrderByStripeSession(session.id);
          if (!order || order.userId !== userId) {
            console.warn("[Stripe webhook] lulu_print: order mismatch or not found");
            break;
          }

          if (order.status !== "awaiting_payment") {
            break;
          }

          if (session.payment_status !== "paid") {
            break;
          }

          const paidCents = session.amount_total ?? 0;
          if (paidCents !== order.retailAmountCents) {
            console.error(
              "[Stripe webhook] lulu_print: amount mismatch",
              paidCents,
              order.retailAmountCents
            );
            break;
          }

          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null;

          await updatePrintOrder(printOrderId, {
            status: "paid",
            stripePaymentIntentId: paymentIntentId,
            errorMessage: null,
          });

          const paidOrder = await getPrintOrderById(printOrderId, userId);
          if (paidOrder) {
            void fulfillPrintOrderToLulu(paidOrder).catch((err) => {
              console.error("[Stripe webhook] lulu_print fulfillment:", err);
            });
          }
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) break;

        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("[Stripe webhook] checkout.session.completed: no userId in metadata");
          break;
        }

        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;

        const tier = priceId ? getTierFromPriceId(priceId) : null;

        await updateSubscriptionFromStripe(userId, {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: tier ?? "spark",
        });

        let affiliateCode = (session.metadata?.affiliateCode as string | undefined) ?? (sub.metadata?.affiliateCode as string | undefined);
        if (affiliateCode) {
          try {
            const affiliate = await getAffiliateByCode(affiliateCode);
            if (affiliate && affiliate.userId !== userId) {
              await setUserReferredBy(userId, affiliate.id);
              const exists = await hasCommissionForSubscription(sub.id, "first_payment");
              if (!exists) {
                let amountCents = 0;
                if (session.invoice) {
                  const inv = await stripe.invoices.retrieve(session.invoice as string);
                  amountCents = inv.amount_paid ?? 0;
                }
                if (amountCents <= 0 && sub.latest_invoice) {
                  const invId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;
                  if (invId) {
                    const inv = await stripe.invoices.retrieve(invId);
                    amountCents = inv.amount_paid ?? 0;
                  }
                }
                if (amountCents > 0) {
                  const commissionAmount = computeCommission(affiliate, amountCents, "first_payment");
                  if (commissionAmount > 0) {
                    await createCommission({
                      affiliateId: affiliate.id,
                      userId,
                      subscriptionId: sub.id,
                      amount: commissionAmount,
                      transactionAmount: amountCents / 100,
                      type: "first_payment",
                    });
                  }
                }
              }
            }
          } catch (affErr) {
            console.warn("[Stripe webhook] Affiliate commission error:", affErr);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;

        const tier = priceId ? getTierFromPriceId(priceId) : null;
        const activeStatuses = ["active", "trialing"];

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: activeStatuses.includes(sub.status)
            ? (tier ?? "spark")
            : "free",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: "canceled",
          stripePriceId: null,
          subscriptionTier: "free",
          tierUpgradeAt: null,
          tierBeforeUpgrade: null,
        });
        break;
      }

      case "subscription_schedule.updated":
      case "subscription_schedule.completed":
      case "subscription_schedule.released": {
        // When a schedule phases (e.g. downgrade takes effect), sync our DB
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        const userId = schedule.metadata?.userId;
        if (!userId || !schedule.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          schedule.subscription as string,
          { expand: ["items.data.price"] }
        );
        const priceId =
          typeof sub.items.data[0]?.price?.id === "string"
            ? sub.items.data[0].price.id
            : sub.items.data[0]?.price?.id ?? null;
        const tier = priceId ? getTierFromPriceId(priceId) : null;
        const activeStatuses = ["active", "trialing"];

        await updateSubscriptionFromStripe(userId, {
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
          subscriptionTier: activeStatuses.includes(sub.status)
            ? (tier ?? "spark")
            : "free",
          tierUpgradeAt: null,
          tierBeforeUpgrade: null,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.parent?.subscription_details?.subscription === "string" ? invoice.parent?.subscription_details?.subscription : invoice.parent?.subscription_details?.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const parentMeta = (invoice as Stripe.Invoice).parent?.subscription_details?.metadata as
          | { affiliateCode?: string; userId?: string }
          | undefined;
        let userId = (sub.metadata?.userId as string | undefined) ?? parentMeta?.userId;
        let affiliateCode =
          (sub.metadata?.affiliateCode as string | undefined) ?? parentMeta?.affiliateCode;
        if (!userId) break;

        if (!affiliateCode) {
          const profile = await getUserProfile(userId);
          if (profile?.referredByAffiliateId) {
            const aff = await getAffiliateById(profile.referredByAffiliateId);
            if (aff?.active) affiliateCode = aff.code;
          }
        }
        if (!affiliateCode) break;

        try {
          const affiliate = await getAffiliateByCode(affiliateCode);
          if (!affiliate || affiliate.userId === userId) break;

          const amountCents = invoice.amount_paid ?? 0;
          if (amountCents <= 0) break;

          if (invoice.billing_reason === "subscription_cycle") {
            if (affiliate.commissionType !== "recurring" && affiliate.commissionType !== "both") break;
            const exists = await hasCommissionForSubscription(subId, "renewal", invoice.id);
            if (exists) break;
            const commissionAmount = computeCommission(affiliate, amountCents, "renewal");
            if (commissionAmount <= 0) break;
            await createCommission({
              affiliateId: affiliate.id,
              userId,
              subscriptionId: subId,
              invoiceId: invoice.id,
              amount: commissionAmount,
              transactionAmount: amountCents / 100,
              type: "renewal",
            });
          } else if (invoice.billing_reason === "subscription_update") {
            const exists = await hasCommissionForSubscription(subId, "upgrade", invoice.id);
            if (exists) break;
            const commissionAmount = computeCommission(affiliate, amountCents, "upgrade");
            if (commissionAmount <= 0) break;
            await createCommission({
              affiliateId: affiliate.id,
              userId,
              subscriptionId: subId,
              invoiceId: invoice.id,
              amount: commissionAmount,
              transactionAmount: amountCents / 100,
              type: "upgrade",
            });
          }
        } catch (affErr) {
          console.warn("[Stripe webhook] Affiliate commission error:", affErr);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("[Stripe webhook] invoice.payment_failed:", invoice.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe webhook] Handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
