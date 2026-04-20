/** Same id sent to Meta CAPI (`event_id`) and browser pixel (`eventID`) for deduplication. */
export function metaSubscriptionPurchaseEventId(checkoutSessionId: string): string {
  return `stripe_cs_${checkoutSessionId}`;
}
