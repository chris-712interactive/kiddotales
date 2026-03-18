-- PayPal ID for affiliate payouts: collected on application, stored on affiliate
ALTER TABLE affiliate_requests
  ADD COLUMN IF NOT EXISTS paypal_id TEXT;

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS paypal_id TEXT;

COMMENT ON COLUMN affiliate_requests.paypal_id IS 'Applicant PayPal ID for receiving payouts (e.g. email or PayPal Me ID)';
COMMENT ON COLUMN affiliates.paypal_id IS 'PayPal ID for sending payouts (copied from request on approval or set manually)';
