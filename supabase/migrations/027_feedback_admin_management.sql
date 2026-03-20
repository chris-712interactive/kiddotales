-- Add admin-management fields for customer feedback workflows.
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by_email TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill updated_at for existing rows if needed.
UPDATE feedback
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Ensure status has only known values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_status_check'
      AND conrelid = 'feedback'::regclass
  ) THEN
    ALTER TABLE feedback
      ADD CONSTRAINT feedback_status_check
      CHECK (status IN ('new', 'in_review', 'resolved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_updated_at ON feedback(updated_at DESC);
