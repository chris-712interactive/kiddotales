-- Affiliate program: track referrals and commissions
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  commission_type TEXT NOT NULL DEFAULT 'first_only' CHECK (commission_type IN ('first_only', 'recurring', 'both')),
  recurring_rate DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  transaction_amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('first_payment', 'renewal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_subscription ON affiliate_commissions(subscription_id);

-- Link users to referring affiliate
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;
