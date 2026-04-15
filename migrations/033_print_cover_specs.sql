-- Per print format: cover bleed / safe text margin / optional spine width (inches).
-- Safe margin keeps text inside the trim box away from cut and fold lines.
-- Optional spine_width_in: when set, spine = this width and leftover horizontal space is split as side bleed.

ALTER TABLE print_book_styles
  ADD COLUMN IF NOT EXISTS cover_bleed_in NUMERIC(8, 4) NOT NULL DEFAULT 0.125
    CHECK (cover_bleed_in >= 0 AND cover_bleed_in <= 1),
  ADD COLUMN IF NOT EXISTS cover_safe_margin_in NUMERIC(8, 4) NOT NULL DEFAULT 0.25
    CHECK (cover_safe_margin_in >= 0 AND cover_safe_margin_in <= 2),
  ADD COLUMN IF NOT EXISTS spine_width_in NUMERIC(8, 4) NULL
    CHECK (spine_width_in IS NULL OR (spine_width_in > 0 AND spine_width_in <= 6));
