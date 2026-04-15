-- Remove life_lesson and art_style from child_profiles (chosen per book, not per profile)
ALTER TABLE child_profiles
  DROP COLUMN IF EXISTS life_lesson,
  DROP COLUMN IF EXISTS art_style;
