-- Add two-way ticket threading for feedback conversations.

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS unread_for_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unread_for_admin BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_user_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_admin_read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  sender_user_id TEXT,
  sender_email TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id_created_at
  ON feedback_messages(feedback_id, created_at);

-- Backfill initial feedback text as first message for existing rows.
INSERT INTO feedback_messages (feedback_id, sender_role, sender_user_id, sender_email, message, created_at)
SELECT
  f.id,
  'user',
  f.user_id,
  f.email,
  f.message,
  f.created_at
FROM feedback f
WHERE NOT EXISTS (
  SELECT 1 FROM feedback_messages fm WHERE fm.feedback_id = f.id
);
