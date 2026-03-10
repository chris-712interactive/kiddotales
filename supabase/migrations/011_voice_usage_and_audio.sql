-- Track AI voice usage per book (one event = one book consumes one voice slot)
CREATE TABLE IF NOT EXISTS user_voice_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_usage_user_created ON user_voice_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_usage_book ON user_voice_usage_events(book_id);
