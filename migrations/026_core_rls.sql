-- Enable Row Level Security (RLS) on core user data tables.
-- App access uses Next.js API routes with createSupabaseAdmin() (service role), which bypasses RLS.
-- These policies exist as a defense-in-depth guardrail if anon/authenticated keys are ever used
-- to query Postgres directly.

-- ========== users ==========
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users may only SELECT their own user row
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own
      ON users
      FOR SELECT
      TO authenticated
      USING (id = auth.uid()::text);
  END IF;

  -- Users may only UPDATE their own user row
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY users_update_own
      ON users
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid()::text)
      WITH CHECK (id = auth.uid()::text);
  END IF;

  -- No INSERT/DELETE policies for authenticated: user rows are created/managed server-side.
END $$;

-- ========== books ==========
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'books' AND policyname = 'books_select_own'
  ) THEN
    CREATE POLICY books_select_own
      ON books
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'books' AND policyname = 'books_insert_own'
  ) THEN
    CREATE POLICY books_insert_own
      ON books
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'books' AND policyname = 'books_update_own'
  ) THEN
    CREATE POLICY books_update_own
      ON books
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'books' AND policyname = 'books_delete_own'
  ) THEN
    CREATE POLICY books_delete_own
      ON books
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- ========== user_book_counts ==========
ALTER TABLE user_book_counts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_book_counts' AND policyname = 'user_book_counts_select_own'
  ) THEN
    CREATE POLICY user_book_counts_select_own
      ON user_book_counts
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_book_counts' AND policyname = 'user_book_counts_insert_own'
  ) THEN
    CREATE POLICY user_book_counts_insert_own
      ON user_book_counts
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_book_counts' AND policyname = 'user_book_counts_update_own'
  ) THEN
    CREATE POLICY user_book_counts_update_own
      ON user_book_counts
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;
END $$;

-- ========== user_book_usage_events ==========
ALTER TABLE user_book_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_book_usage_events' AND policyname = 'user_book_usage_events_select_own'
  ) THEN
    CREATE POLICY user_book_usage_events_select_own
      ON user_book_usage_events
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_book_usage_events' AND policyname = 'user_book_usage_events_insert_own'
  ) THEN
    CREATE POLICY user_book_usage_events_insert_own
      ON user_book_usage_events
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;
END $$;

-- ========== user_voice_usage_events ==========
ALTER TABLE user_voice_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_voice_usage_events' AND policyname = 'user_voice_usage_events_select_own'
  ) THEN
    CREATE POLICY user_voice_usage_events_select_own
      ON user_voice_usage_events
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_voice_usage_events' AND policyname = 'user_voice_usage_events_insert_own'
  ) THEN
    CREATE POLICY user_voice_usage_events_insert_own
      ON user_voice_usage_events
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;
END $$;

-- ========== feedback ==========
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies:
-- - App writes feedback via server (service role).
-- - Avoid exposing a direct anon/authenticated insert surface in Postgres.

