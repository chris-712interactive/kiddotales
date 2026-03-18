-- Affiliate removal: soft delete only. Commission history retained 7 years for tax purposes.
-- Add active flag (inactive = removed from program, commissions preserved)
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_affiliates_active ON affiliates(active) WHERE active = true;

-- Prevent accidental hard deletes that would cascade and lose commission history
ALTER TABLE affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_affiliate_id_fkey;

ALTER TABLE affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE RESTRICT;
