-- Track book creation usage per period (deletions do not reduce usage)
CREATE TABLE IF NOT EXISTS user_book_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_user_book_usage_user_id ON user_book_usage(user_id);
