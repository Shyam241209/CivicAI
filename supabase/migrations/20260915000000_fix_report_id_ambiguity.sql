-- Fix ambiguous report_id references in the report assignment and status workflow.
-- The app relies on these DB functions for assignment routing and status transitions,
-- so the fix keeps the workflow intact while making each column reference explicit.

CREATE OR REPLACE FUNCTION public.is_staff_for_report(
  p_user_id uuid,
  p_report_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.civic_reports AS r
    INNER JOIN public.department_users AS du
      ON du.department_id = r.assigned_department_id
    WHERE r.id = p_report_id
      AND du.user_id = p_user_id
      AND du.status = 'active'
  );
$$;

DROP POLICY IF EXISTS "Staff can view assigned report history" ON public.report_status_history;
CREATE POLICY "Staff can view assigned report history"
  ON public.report_status_history FOR SELECT TO authenticated
  USING (public.is_staff_for_report(auth.uid(), report_status_history.report_id));

DROP POLICY IF EXISTS "Authorized users can view assignments" ON public.report_assignments;
CREATE POLICY "Authorized users can view assignments"
  ON public.report_assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_staff_for_report(auth.uid(), public.report_assignments.report_id)
    OR EXISTS (
      SELECT 1
      FROM public.civic_reports AS r
      WHERE r.id = public.report_assignments.report_id
        AND r.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.sync_report_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  department_name text;
BEGIN
  IF NEW.assigned_department_id IS NULL OR
     (TG_OP = 'UPDATE' AND NEW.assigned_department_id IS NOT DISTINCT FROM OLD.assigned_department_id) THEN
    RETURN NEW;
  END IF;

  SELECT d.name INTO department_name
  FROM public.departments AS d
  WHERE d.id = NEW.assigned_department_id;

  INSERT INTO public.report_assignments (report_id, department_id, assigned_by)
  VALUES (NEW.id, NEW.assigned_department_id, auth.uid());

  INSERT INTO public.notifications (user_id, title, message, type, report_id)
  SELECT du.user_id,
    'New report assigned',
    'A civic report has been assigned to ' || COALESCE(department_name, 'your department') || '.',
    'assignment',
    NEW.id
  FROM public.department_users AS du
  WHERE du.department_id = NEW.assigned_department_id
    AND du.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.user_id = du.user_id
        AND n.report_id = NEW.id
        AND n.type = 'assignment'
    );

  IF NEW.assigned_staff_id IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.assigned_staff_id IS DISTINCT FROM OLD.assigned_staff_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    SELECT NEW.assigned_staff_id,
      'Report assigned to you',
      'A civic report has been assigned to you.',
      'assignment',
      NEW.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.user_id = NEW.assigned_staff_id
        AND n.report_id = NEW.id
        AND n.type = 'assignment'
    );
  END IF;

  RETURN NEW;
END;
$$;

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
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_staff boolean;
  actor_role text;
  status_message text;
BEGIN
  SELECT cr.* INTO current_report
  FROM public.civic_reports AS cr
  WHERE cr.id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  is_staff := public.is_staff_for_report(auth.uid(), p_report_id);

  IF NOT is_admin AND NOT is_staff THEN
    RAISE EXCEPTION 'You are not authorized for this report';
  END IF;

  IF next_status NOT IN ('SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Unsupported report status: %', p_status;
  END IF;

  IF is_staff AND next_status NOT IN ('IN_PROGRESS', 'RESOLVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Department staff cannot perform this transition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.report_status_history AS rsh
    WHERE rsh.report_id = p_report_id
      AND rsh.status = next_status
  ) THEN
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

  actor_role := CASE WHEN is_admin THEN 'admin' ELSE 'staff' END;
  status_message := COALESCE(p_message, CASE next_status
    WHEN 'VERIFIED' THEN 'Your report was verified by the administration.'
    WHEN 'ASSIGNED' THEN 'Your report was forwarded to the responsible department.'
    WHEN 'IN_PROGRESS' THEN 'Department staff has started working on the issue.'
    WHEN 'RESOLVED' THEN 'Your civic report has been resolved.'
    WHEN 'REJECTED' THEN 'Your civic report was rejected by the administration.'
    ELSE 'Your civic report was submitted.'
  END);

  PERFORM set_config('civicai.status_transition', 'true', true);

  UPDATE public.civic_reports AS cr
  SET status = lower(next_status), updated_at = now()
  WHERE cr.id = p_report_id;

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
      SELECT 1
      FROM public.notifications AS n
      WHERE n.report_id = p_report_id
        AND n.type = 'status_change'
        AND n.message = status_message
    );
  END IF;

  RETURN QUERY SELECT p_report_id, next_status, now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_civic_report_status(uuid, text, text) TO authenticated;
