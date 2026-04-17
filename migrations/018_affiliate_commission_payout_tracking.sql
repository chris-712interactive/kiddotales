-- Payout reconciliation: when a commission was paid and under what payout type (for accounting)
ALTER TABLE affiliate_commissions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_type TEXT;

COMMENT ON COLUMN affiliate_commissions.paid_at IS 'When this commission was reconciled/paid (set when status becomes paid)';
COMMENT ON COLUMN affiliate_commissions.payout_type IS 'Accounting label for the payout run (e.g. Monthly - February 2025)';
