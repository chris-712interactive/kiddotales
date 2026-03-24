-- Gift memberships purchased by one user and redeemed by another.

CREATE TABLE IF NOT EXISTS gift_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  purchaser_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  purchaser_email TEXT,
  recipient_email TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('spark', 'magic', 'legend')),
  duration_months INT NOT NULL CHECK (duration_months > 0),
  status TEXT NOT NULL DEFAULT 'purchased' CHECK (status IN ('purchased', 'redeemed', 'expired', 'cancelled')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  redeemed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_memberships_code ON gift_memberships(code);
CREATE INDEX IF NOT EXISTS idx_gift_memberships_redeemed_user ON gift_memberships(redeemed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_gift_memberships_status ON gift_memberships(status);
CREATE INDEX IF NOT EXISTS idx_gift_memberships_active_window ON gift_memberships(starts_at, ends_at);
