-- Enable Row Level Security on affiliate-related tables.
-- App access uses createSupabaseAdmin() (service role), which bypasses RLS.
-- Policies restrict any Supabase client using anon/authenticated to own data only.

-- ========== affiliates ==========
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Affiliates may only SELECT their own row (where user_id = current user)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'affiliates_select_own'
  ) THEN
    CREATE POLICY affiliates_select_own
      ON affiliates
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  -- Affiliates may only UPDATE their own row (e.g. PayPal ID, profile)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'affiliates_update_own'
  ) THEN
    CREATE POLICY affiliates_update_own
      ON affiliates
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  -- No INSERT/DELETE for authenticated: only admins (service role) create/remove affiliates.
END $$;

-- ========== affiliate_requests ==========
ALTER TABLE affiliate_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users may only SELECT their own affiliate request(s)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_requests' AND policyname = 'affiliate_requests_select_own'
  ) THEN
    CREATE POLICY affiliate_requests_select_own
      ON affiliate_requests
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  -- Users may only INSERT an affiliate request for themselves (apply)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_requests' AND policyname = 'affiliate_requests_insert_own'
  ) THEN
    CREATE POLICY affiliate_requests_insert_own
      ON affiliate_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  -- No UPDATE/DELETE for authenticated: only admins approve/reject/update.
END $$;

-- ========== affiliate_commissions ==========
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Affiliates may only SELECT their own commissions (where affiliate is linked to their user_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_commissions' AND policyname = 'affiliate_commissions_select_own'
  ) THEN
    CREATE POLICY affiliate_commissions_select_own
      ON affiliate_commissions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM affiliates a
          WHERE a.id = affiliate_commissions.affiliate_id
            AND a.user_id = auth.uid()::text
        )
      );
  END IF;

  -- No INSERT/UPDATE/DELETE for authenticated: only system/admin creates and updates commissions.
END $$;
