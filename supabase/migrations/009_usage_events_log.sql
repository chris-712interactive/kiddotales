-- Transaction log for book creation usage (replaces counter-based user_book_usage)
CREATE TABLE IF NOT EXISTS user_book_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  book_id UUID
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON user_book_usage_events(user_id, created_at);

-- Backfill from existing books (one event per book)
INSERT INTO user_book_usage_events (user_id, created_at, book_id)
SELECT user_id, created_at, id
FROM books;

-- Drop old table
DROP TABLE IF EXISTS user_book_usage;
