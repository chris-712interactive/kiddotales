-- Track mid-cycle upgrades for prorated book limits
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tier_upgrade_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier_before_upgrade TEXT;
