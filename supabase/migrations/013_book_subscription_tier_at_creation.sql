-- Store subscription tier at book creation for accurate analytics
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS subscription_tier_at_creation TEXT;
