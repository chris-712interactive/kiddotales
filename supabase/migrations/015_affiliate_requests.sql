-- Affiliate requests: users apply to become affiliates (must have KiddoTales account)
-- Add user_id to affiliates to link approved affiliates to their account
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id) WHERE user_id IS NOT NULL;

-- Pending affiliate applications
CREATE TABLE IF NOT EXISTS affiliate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  audience_size INTEGER NOT NULL,
  pitch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_requests_user_id ON affiliate_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_requests_status ON affiliate_requests(status);
