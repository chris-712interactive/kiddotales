-- Book creation metadata (for correction flow)
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS creation_metadata JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Child profiles (optional, for form prefilling)
CREATE TABLE IF NOT EXISTS child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT NOT NULL DEFAULT 5,
  pronouns TEXT DEFAULT 'they/them',
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  life_lesson TEXT DEFAULT 'kindness',
  art_style TEXT DEFAULT 'whimsical-watercolor',
  appearance JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles(user_id);
