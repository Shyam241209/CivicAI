
-- 1) Remove public SELECT on civic_reports
DROP POLICY IF EXISTS "Anyone can view all reports" ON public.civic_reports;

-- 2) Public sanitized reports function (no user_id, coarse coords)
CREATE OR REPLACE FUNCTION public.get_public_reports()
RETURNS TABLE (
  id uuid,
  status text,
  issue_category text,
  severity text,
  priority_level text,
  short_description text,
  created_at timestamptz,
  updated_at timestamptz,
  image_url text,
  suggested_department text,
  assigned_department_id uuid,
  location_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.issue_category,
    r.severity,
    r.priority_level,
    r.short_description,
    r.created_at,
    r.updated_at,
    r.image_url,
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
$$;

REVOKE ALL ON FUNCTION public.get_public_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reports() TO authenticated, anon;

-- 3) Defense-in-depth: RESTRICTIVE policies on user_roles so only admins can modify
DROP POLICY IF EXISTS "Only admins can insert roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can insert roles (restrictive)"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can update roles (restrictive)"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can delete roles (restrictive)"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
