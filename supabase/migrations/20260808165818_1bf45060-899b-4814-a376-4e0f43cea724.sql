-- 1. Storage: ownership-scoped policies for civic-reports
DROP POLICY IF EXISTS "civic_reports_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "civic_reports_authenticated_insert" ON storage.objects;

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

-- 2. get_user_role: no longer needs SECURITY DEFINER (RLS lets users read their own role)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY (role = 'admin') DESC LIMIT 1),
    'user'::app_role
  )
$$;

-- 3. Replace the SECURITY DEFINER public map function with a restricted view
DROP FUNCTION IF EXISTS public.get_public_reports();

CREATE OR REPLACE VIEW public.public_reports
WITH (security_invoker = false) AS
SELECT
  r.id,
  r.status,
  r.issue_category,
  r.severity,
  r.priority_level,
  r.short_description,
  r.created_at,
  r.updated_at,
  r.suggested_department,
  r.assigned_department_id,
  CASE
    WHEN r.location_data ? 'lat' AND r.location_data ? 'lng' THEN
      jsonb_build_object(
        'lat', round((r.location_data->>'lat')::numeric, 3),
        'lng', round((r.location_data->>'lng')::numeric, 3),
        'address', COALESCE(r.location_data->>'area', r.location_data->>'city', '')
      )
    ELSE NULL
  END AS location_data
FROM public.civic_reports r
WHERE r.location_data IS NOT NULL;

GRANT SELECT ON public.public_reports TO authenticated;
GRANT SELECT ON public.public_reports TO anon;