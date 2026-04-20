import crypto from "crypto";
import { metaSubscriptionPurchaseEventId } from "@/lib/meta-pixel-shared";

/**
 * Meta (Facebook) Conversions API — server-side events for ad attribution.
 * Uses the same event_id as the browser pixel if you pass `event_id` to fbq (deduplication).
 *
 * Env (optional — no-op if META_PIXEL_ID or META_CAPI_ACCESS_TOKEN is unset):
 * - META_PIXEL_ID — Events Manager → Data sources → your Pixel → Pixel ID
 * - META_CAPI_ACCESS_TOKEN — Pixel → Settings → Conversions API → Generate access token
 * - META_CAPI_TEST_EVENT_CODE — optional; Test events tab in Events Manager
 * - META_CAPI_EVENT_NAME — optional; default "Purchase" (use "Subscribe" if you prefer that standard event)
 */

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function hashEmailForMeta(email: string): string {
  return sha256Hex(email.trim().toLowerCase());
}

function hashExternalId(id: string): string {
  return sha256Hex(String(id).trim());
}

export type MetaSubscriptionPurchaseParams = {
  checkoutSessionId: string;
  userId: string;
  /** Major units (e.g. dollars), not cents */
  value: number;
  currency: string;
  customerEmail?: string | null;
};

/**
 * Fires when a Stripe Checkout subscription completes (new subscription).
 * Safe to call from both the Stripe webhook and confirm-session: identical `event_id` dedupes in Meta.
 */
export async function sendMetaSubscriptionPurchaseEvent(
  params: MetaSubscriptionPurchaseParams
): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !accessToken) {
    return;
  }

  const eventName =
    process.env.META_CAPI_EVENT_NAME?.trim() || "Purchase";
  const eventId = metaSubscriptionPurchaseEventId(params.checkoutSessionId);

  const user_data: Record<string, string[]> = {
    external_id: [hashExternalId(params.userId)],
  };
  if (params.customerEmail?.trim()) {
    user_data.em = [hashEmailForMeta(params.customerEmail)];
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "system_generated",
        user_data,
        custom_data: {
          currency: params.currency.toUpperCase(),
          value: params.value,
          content_type: "subscription",
        },
      },
    ],
  };

  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) {
    payload.test_event_code = testCode;
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${pixelId}/events`);
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(
        "[KiddoTales] Meta CAPI:",
        res.status,
        text.slice(0, 800)
      );
    }
  } catch (err) {
    console.error("[KiddoTales] Meta CAPI request failed:", err);
  }
}
