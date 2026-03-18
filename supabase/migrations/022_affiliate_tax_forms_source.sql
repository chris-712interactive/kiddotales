-- Distinguish electronic vs uploaded W-9 and store e-sign timestamp (no PII fields).
ALTER TABLE affiliate_tax_forms
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (source IN ('electronic', 'uploaded')),
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Backfill any existing rows that pre-date this column
UPDATE affiliate_tax_forms SET source = 'uploaded' WHERE source IS NULL;

