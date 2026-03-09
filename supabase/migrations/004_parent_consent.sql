-- COPPA: Parental consent tracking for child data collection
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parent_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_consent_version TEXT DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS idx_users_parent_consent_at ON users(parent_consent_at);
