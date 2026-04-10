/**
 * When upgrading mid-cycle, Stripe proration can produce a very small charge.
 * If the previewed amount due is below this threshold (in the invoice currency’s
 * smallest unit, e.g. cents for USD), we apply the new price with
 * proration_behavior: "none" so there is no immediate charge; renewal date is unchanged.
 *
 * Set to 0 to disable (always invoice proration). Default 100 = waive under $1.00 USD.
 */
export function getUpgradeProrationWaiverThresholdCents(): number {
  const raw = process.env.UPGRADE_PRORATION_WAIVER_THRESHOLD_CENTS;
  if (raw === undefined || raw === "") return 100;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return 100;
  return n;
}

export function shouldWaiveUpgradeProration(amountDueCents: number): boolean {
  const threshold = getUpgradeProrationWaiverThresholdCents();
  return threshold > 0 && amountDueCents < threshold;
}
