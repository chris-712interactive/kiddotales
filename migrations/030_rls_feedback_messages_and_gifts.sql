-- Enable Row Level Security on newer tables.
-- App access uses Next.js API routes with createSupabaseAdmin() (service role), which bypasses RLS.
-- These policies are defense-in-depth for any direct client DB access.

-- NOTE FOR FUTURE TABLES:
-- New tables should include `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
-- and explicit policies in the same migration.

-- ========== feedback_messages ==========
ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users may only SELECT messages for feedback tickets they own.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_messages'
      AND policyname = 'feedback_messages_select_ticket_owner'
  ) THEN
    CREATE POLICY feedback_messages_select_ticket_owner
      ON feedback_messages
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM feedback f
          WHERE f.id = feedback_messages.feedback_id
            AND f.user_id = auth.uid()::text
        )
      );
  END IF;

  -- No INSERT/UPDATE/DELETE policies for authenticated:
  -- feedback threading is managed server-side.
END $$;

-- ========== gift_memberships ==========
ALTER TABLE gift_memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users may SELECT gifts they purchased or redeemed.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gift_memberships'
      AND policyname = 'gift_memberships_select_own'
  ) THEN
    CREATE POLICY gift_memberships_select_own
      ON gift_memberships
      FOR SELECT
      TO authenticated
      USING (
        purchaser_user_id = auth.uid()::text
        OR redeemed_by_user_id = auth.uid()::text
      );
  END IF;

  -- No INSERT/UPDATE/DELETE policies for authenticated:
  -- gift creation/redemption is managed server-side.
END $$;
