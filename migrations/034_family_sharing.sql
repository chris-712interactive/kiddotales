-- Family sharing: Legend subscribers invite up to N household members (see entitlements.sharingSeats).
-- Members use the owner's subscription pool for book/voice limits and inherit plan features.

CREATE TABLE IF NOT EXISTS family_share_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  member_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_family_share_invites_owner ON family_share_invites(owner_user_id);

CREATE TABLE IF NOT EXISTS family_share_members (
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_share_members_owner ON family_share_members(owner_user_id);

-- Attribute book/voice usage to the billing account (subscriber) when a family member creates content.
ALTER TABLE user_book_usage_events
  ADD COLUMN IF NOT EXISTS billing_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

UPDATE user_book_usage_events SET billing_user_id = user_id WHERE billing_user_id IS NULL;

ALTER TABLE user_book_usage_events ALTER COLUMN billing_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_book_usage_billing_created
  ON user_book_usage_events(billing_user_id, created_at);

ALTER TABLE user_voice_usage_events
  ADD COLUMN IF NOT EXISTS billing_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

UPDATE user_voice_usage_events SET billing_user_id = user_id WHERE billing_user_id IS NULL;

ALTER TABLE user_voice_usage_events ALTER COLUMN billing_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_voice_usage_billing_created
  ON user_voice_usage_events(billing_user_id, created_at);

-- RLS (defense in depth; app uses service role)
ALTER TABLE family_share_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_share_members ENABLE ROW LEVEL SECURITY;
