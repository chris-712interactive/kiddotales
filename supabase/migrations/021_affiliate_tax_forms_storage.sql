-- Supabase Storage setup for W-9 files.
-- Creates a private bucket and policies to allow affiliates to upload to their own folder.

-- Create private bucket (id = name) if it doesn't exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('affiliate-tax-forms', 'affiliate-tax-forms', false)
ON CONFLICT (id) DO NOTHING;

-- Note: storage.objects is managed by Supabase and already has RLS enabled.
-- Avoid ALTER TABLE here because it can fail unless executed as the table owner.

-- Affiliates can create signed upload URLs for paths under affiliate/{affiliateId}/...
-- Policy needed for createSignedUploadUrl(): requires INSERT permission on storage.objects.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'affiliate_tax_forms_insert_own_folder'
  ) THEN
    CREATE POLICY affiliate_tax_forms_insert_own_folder
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'affiliate-tax-forms'
        AND EXISTS (
          SELECT 1
          FROM public.affiliates a
          WHERE a.user_id = auth.uid()::text
            AND a.active = true
            AND ('affiliate/' || a.id::text || '/') = substring(name from 1 for length('affiliate/' || a.id::text || '/'))
        )
      );
  END IF;

  -- Prevent affiliates from reading/listing any W-9 objects.
  -- (No SELECT policy for authenticated users on this bucket.)

  -- Admin reads happen via service role (bypasses RLS). If you later move to non-service admin auth,
  -- you can add a dedicated role/policy here.
END $$;

