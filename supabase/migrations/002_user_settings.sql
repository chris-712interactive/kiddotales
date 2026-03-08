-- Add contact info, subscription, and theme fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
