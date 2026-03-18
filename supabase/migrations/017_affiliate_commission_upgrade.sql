-- Allow 'upgrade' commission type for subscription upgrade invoices
ALTER TABLE affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_type_check;

ALTER TABLE affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_type_check
  CHECK (type IN ('first_payment', 'renewal', 'upgrade'));
