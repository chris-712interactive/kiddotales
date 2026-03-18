-- Affiliate tax forms (W-9) metadata and audit log.
-- Store files in Supabase Storage (private bucket), never in Postgres.

CREATE TABLE IF NOT EXISTS affiliate_tax_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT,
  sha256 TEXT,
  year INTEGER,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_tax_forms_affiliate_id ON affiliate_tax_forms(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tax_forms_status ON affiliate_tax_forms(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_tax_forms_uploaded_at ON affiliate_tax_forms(uploaded_at DESC);

-- One "current" W-9 per affiliate per year (optional year).
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_tax_forms_affiliate_year
  ON affiliate_tax_forms(affiliate_id, year)
  WHERE year IS NOT NULL;

CREATE TABLE IF NOT EXISTS affiliate_tax_form_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_form_id UUID NOT NULL REFERENCES affiliate_tax_forms(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('uploaded', 'downloaded', 'verified', 'rejected')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_tax_form_audit_tax_form_id ON affiliate_tax_form_audit(tax_form_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tax_form_audit_created_at ON affiliate_tax_form_audit(created_at DESC);

ALTER TABLE affiliate_tax_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tax_form_audit ENABLE ROW LEVEL SECURITY;

-- Minimal RLS: allow affiliate to see their own tax forms/audit via their affiliate record.
-- Service role (used by admin API routes) bypasses RLS.
DO $$
BEGIN
  -- Select forms for own affiliate
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_tax_forms' AND policyname = 'select_own_affiliate_tax_forms'
  ) THEN
    CREATE POLICY select_own_affiliate_tax_forms
      ON affiliate_tax_forms
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM affiliates a
          WHERE a.id = affiliate_tax_forms.affiliate_id
            AND a.user_id = auth.uid()::text
            AND a.active = true
        )
      );
  END IF;

  -- Insert form for own affiliate (write metadata only; file upload is handled via Storage signed upload)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_tax_forms' AND policyname = 'insert_own_affiliate_tax_forms'
  ) THEN
    CREATE POLICY insert_own_affiliate_tax_forms
      ON affiliate_tax_forms
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM affiliates a
          WHERE a.id = affiliate_tax_forms.affiliate_id
            AND a.user_id = auth.uid()::text
            AND a.active = true
        )
      );
  END IF;

  -- Select audit for own forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_tax_form_audit' AND policyname = 'select_own_affiliate_tax_form_audit'
  ) THEN
    CREATE POLICY select_own_affiliate_tax_form_audit
      ON affiliate_tax_form_audit
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM affiliate_tax_forms f
          JOIN affiliates a ON a.id = f.affiliate_id
          WHERE f.id = affiliate_tax_form_audit.tax_form_id
            AND a.user_id = auth.uid()::text
            AND a.active = true
        )
      );
  END IF;
END $$;

