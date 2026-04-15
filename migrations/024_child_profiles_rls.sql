-- Enable Row Level Security on child_profiles (sensitive data: children's names, ages, interests).
-- App access is via Next.js API using createSupabaseAdmin() (service role), which bypasses RLS.
-- These policies ensure that any Supabase client using anon/authenticated keys can only
-- access rows where user_id matches auth.uid(); with NextAuth-only auth, auth.uid() is typically
-- unset so no direct client access would see any rows.

ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users may only SELECT their own child profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'child_profiles' AND policyname = 'child_profiles_select_own'
  ) THEN
    CREATE POLICY child_profiles_select_own
      ON child_profiles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  -- Users may only INSERT child profiles for themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'child_profiles' AND policyname = 'child_profiles_insert_own'
  ) THEN
    CREATE POLICY child_profiles_insert_own
      ON child_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  -- Users may only UPDATE their own child profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'child_profiles' AND policyname = 'child_profiles_update_own'
  ) THEN
    CREATE POLICY child_profiles_update_own
      ON child_profiles
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  -- Users may only DELETE their own child profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'child_profiles' AND policyname = 'child_profiles_delete_own'
  ) THEN
    CREATE POLICY child_profiles_delete_own
      ON child_profiles
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;
END $$;
