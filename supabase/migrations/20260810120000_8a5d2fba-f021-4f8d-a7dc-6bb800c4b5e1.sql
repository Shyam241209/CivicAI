-- Fix storage RLS for civic-reports image upload and access
-- Allow authenticated users to upload/read objects in their own user-id folder only.

DROP POLICY IF EXISTS "Authenticated users can view civic reports 53eaqk_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 53eaqk_0" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "Public upload access to civic-reports" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to civic-reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view report images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload report images" ON storage.objects;

CREATE POLICY "civic_reports_owner_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'civic-reports'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "civic_reports_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "civic_reports_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "civic_reports_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
