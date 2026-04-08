export type PrintPricingRules = {
  markupPercent: number;
  flatFeeCents: number;
  minRetailCents: number | null;
  maxRetailCents: number | null;
  roundToNineteen: boolean;
};

/** Parse Lulu decimal string (e.g. "12.34") to integer cents. */
export function luluDecimalToCents(value: string | undefined | null): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Retail price from Lulu wholesale total (incl. tax), using admin rules.
 */
export function computeRetailCents(
  wholesaleInclTaxCents: number,
  rules: PrintPricingRules
): number {
  const pct = rules.markupPercent / 100;
  let cents = Math.round(wholesaleInclTaxCents * (1 + pct) + rules.flatFeeCents);

  if (rules.minRetailCents != null && cents < rules.minRetailCents) {
    cents = rules.minRetailCents;
  }
  if (rules.maxRetailCents != null && cents > rules.maxRetailCents) {
    cents = rules.maxRetailCents;
  }

  if (rules.roundToNineteen) {
    const dollar = Math.floor(cents / 100);
    let target = dollar * 100 + 99;
    if (target < cents) target += 100;
    cents = target;
  }

  return Math.max(0, cents);
}
