-- Store client IP on tax form audit for IRS e-signature / audit trail guidance.
ALTER TABLE affiliate_tax_form_audit
  ADD COLUMN IF NOT EXISTS client_ip TEXT;

COMMENT ON COLUMN affiliate_tax_form_audit.client_ip IS 'Client IP at time of action (for e-signature audit trail; may be null if unavailable).';
