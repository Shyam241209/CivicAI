-- 1. Storage: consolidate to least-privilege, authenticated-only policies
DROP POLICY IF EXISTS "Public upload access to civic-reports" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to civic-reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view report images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload report images" ON storage.objects;

CREATE POLICY "civic_reports_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'civic-reports');

CREATE POLICY "civic_reports_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'civic-reports');

-- 2. SECURITY DEFINER functions: revoke direct API execution
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_report_changes() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_status_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_reports() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reports() TO authenticated;