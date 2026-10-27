-- Durable civic report tracking for the Tamil Nadu workflow.
-- Keep legacy pending/in_review values valid while new writes use the explicit lifecycle.

ALTER TABLE public.civic_reports DROP CONSTRAINT IF EXISTS civic_reports_status_check;
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS resolution_image_url text;
ALTER TABLE public.civic_reports
  ADD CONSTRAINT civic_reports_status_check CHECK (
    status IN ('pending', 'submitted', 'in_review', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected')
  );

CREATE TABLE IF NOT EXISTS public.report_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.civic_reports(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
  message text,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_role text,
  department_id uuid REFERENCES public.departments(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, status)
);

ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citizens can view their own status history"
  ON public.report_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.civic_reports r
      WHERE r.id = report_status_history.report_id AND r.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS report_status_history_report_id_changed_at_idx
  ON public.report_status_history(report_id, changed_at);

ALTER TABLE public.report_status_history REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.report_status_history;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.seed_report_submitted_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.report_status_history (report_id, status, message, changed_by, changed_by_role)
  VALUES (NEW.id, 'SUBMITTED', 'Your civic report was successfully submitted.', NEW.user_id, 'citizen')
  ON CONFLICT (report_id, status) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS civic_report_submitted_history ON public.civic_reports;
CREATE TRIGGER civic_report_submitted_history
  AFTER INSERT ON public.civic_reports
  FOR EACH ROW EXECUTE FUNCTION public.seed_report_submitted_history();

CREATE OR REPLACE FUNCTION public.transition_civic_report_status(
  p_report_id uuid,
  p_status text,
  p_message text DEFAULT NULL
)
RETURNS TABLE (report_id uuid, status text, changed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_report public.civic_reports%ROWTYPE;
  next_status text := upper(trim(p_status));
  actor_role text := CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN 'admin' ELSE 'user' END;
  status_message text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only authorized administrators can transition report status';
  END IF;

  SELECT * INTO current_report
  FROM public.civic_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF next_status NOT IN ('SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Unsupported report status: %', p_status;
  END IF;

  IF EXISTS (SELECT 1 FROM public.report_status_history WHERE report_id = p_report_id AND status = next_status) THEN
    RAISE EXCEPTION 'Report has already entered status %', next_status;
  END IF;

  IF NOT (
    (COALESCE(current_report.status, 'pending') IN ('pending', 'submitted', 'in_review') AND next_status IN ('VERIFIED', 'REJECTED')) OR
    (COALESCE(current_report.status, 'pending') = 'verified' AND next_status IN ('ASSIGNED', 'REJECTED')) OR
    (COALESCE(current_report.status, 'pending') = 'assigned' AND next_status IN ('IN_PROGRESS', 'REJECTED')) OR
    (COALESCE(current_report.status, 'pending') = 'in_progress' AND next_status IN ('RESOLVED', 'REJECTED'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', COALESCE(current_report.status, 'pending'), next_status;
  END IF;

  IF next_status = 'RESOLVED' AND NULLIF(current_report.resolution_image_url, '') IS NULL THEN
    RAISE EXCEPTION 'Resolution evidence is required before resolving a report';
  END IF;

  IF next_status = 'REJECTED' AND NULLIF(trim(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  status_message := COALESCE(p_message, CASE next_status
    WHEN 'VERIFIED' THEN 'Your report was verified by the administration.'
    WHEN 'ASSIGNED' THEN 'Your report was forwarded to the responsible department.'
    WHEN 'IN_PROGRESS' THEN 'Department staff has started working on the issue.'
    WHEN 'RESOLVED' THEN 'Your civic report has been resolved.'
    WHEN 'REJECTED' THEN 'Your civic report was rejected by the administration.'
    ELSE 'Your civic report was submitted.'
  END);

  UPDATE public.civic_reports
  SET status = lower(next_status), updated_at = now()
  WHERE id = p_report_id;

  INSERT INTO public.report_status_history (
    report_id, status, message, changed_by, changed_by_role, department_id
  ) VALUES (
    p_report_id, next_status, status_message, auth.uid(), actor_role, current_report.assigned_department_id
  );

  IF current_report.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    SELECT current_report.user_id,
      CASE next_status
        WHEN 'VERIFIED' THEN 'Report verified'
        WHEN 'ASSIGNED' THEN 'Department assigned'
        WHEN 'IN_PROGRESS' THEN 'Work has started'
        WHEN 'RESOLVED' THEN 'Report resolved'
        WHEN 'REJECTED' THEN 'Report rejected'
        ELSE 'Report status updated'
      END,
      status_message,
      'status_change',
      p_report_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.report_id = p_report_id AND n.type = 'status_change' AND n.message = status_message
    );
  END IF;

  RETURN QUERY SELECT p_report_id, next_status, now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_civic_report_status(uuid, text, text) TO authenticated;
