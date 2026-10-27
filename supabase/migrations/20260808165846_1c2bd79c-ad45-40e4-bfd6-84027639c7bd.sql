DROP VIEW IF EXISTS public.public_reports;

CREATE TABLE public.public_reports (
  id uuid PRIMARY KEY,
  status text,
  issue_category text,
  severity text,
  priority_level text,
  short_description text,
  suggested_department text,
  assigned_department_id uuid,
  location_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_reports TO authenticated;
GRANT SELECT ON public.public_reports TO anon;
GRANT ALL ON public.public_reports TO service_role;

ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymized public reports are readable"
ON public.public_reports FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _loc jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_reports WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.location_data IS NULL
     OR NOT (NEW.location_data ? 'lat' AND NEW.location_data ? 'lng') THEN
    DELETE FROM public.public_reports WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  _loc := jsonb_build_object(
    'lat', round((NEW.location_data->>'lat')::numeric, 3),
    'lng', round((NEW.location_data->>'lng')::numeric, 3),
    'address', COALESCE(NEW.location_data->>'area', NEW.location_data->>'city', '')
  );

  INSERT INTO public.public_reports (
    id, status, issue_category, severity, priority_level, short_description,
    suggested_department, assigned_department_id, location_data, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.status, NEW.issue_category, NEW.severity, NEW.priority_level, NEW.short_description,
    NEW.suggested_department, NEW.assigned_department_id, _loc, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    issue_category = EXCLUDED.issue_category,
    severity = EXCLUDED.severity,
    priority_level = EXCLUDED.priority_level,
    short_description = EXCLUDED.short_description,
    suggested_department = EXCLUDED.suggested_department,
    assigned_department_id = EXCLUDED.assigned_department_id,
    location_data = EXCLUDED.location_data,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_public_report
AFTER INSERT OR UPDATE OR DELETE ON public.civic_reports
FOR EACH ROW EXECUTE FUNCTION public.sync_public_report();

-- Backfill existing reports
INSERT INTO public.public_reports (
  id, status, issue_category, severity, priority_level, short_description,
  suggested_department, assigned_department_id, location_data, created_at, updated_at
)
SELECT r.id, r.status, r.issue_category, r.severity, r.priority_level, r.short_description,
  r.suggested_department, r.assigned_department_id,
  jsonb_build_object(
    'lat', round((r.location_data->>'lat')::numeric, 3),
    'lng', round((r.location_data->>'lng')::numeric, 3),
    'address', COALESCE(r.location_data->>'area', r.location_data->>'city', '')
  ),
  r.created_at, r.updated_at
FROM public.civic_reports r
WHERE r.location_data ? 'lat' AND r.location_data ? 'lng'
ON CONFLICT (id) DO NOTHING;