-- Data retention: track last opened per book, last login per user
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_books_last_opened_at ON books(last_opened_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
