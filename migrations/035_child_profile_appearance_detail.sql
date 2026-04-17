-- Rich reusable character description from optional photo analysis (photo itself is never stored).
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS appearance_detailed_description TEXT,
  ADD COLUMN IF NOT EXISTS appearance_detailed_description_version TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS appearance_derived_from_photo_at TIMESTAMPTZ;
