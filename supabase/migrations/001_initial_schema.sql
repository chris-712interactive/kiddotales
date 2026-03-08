-- Users: synced from NextAuth (id from provider)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book counts per user (enforces limit)
CREATE TABLE IF NOT EXISTS user_book_counts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  book_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books: server-side storage for cross-device sync
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cover_image_url TEXT,
  cover_image_data TEXT,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
