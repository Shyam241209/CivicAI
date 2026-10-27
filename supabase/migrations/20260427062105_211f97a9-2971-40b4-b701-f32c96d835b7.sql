-- 1) Department capacity
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS max_active_complaints integer NOT NULL DEFAULT 50;

-- 2) Complaint assignment fields
ALTER TABLE public.civic_reports
  ADD COLUMN IF NOT EXISTS assigned_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_officer text,
  ADD COLUMN IF NOT EXISTS admin_remarks text;

CREATE INDEX IF NOT EXISTS idx_civic_reports_assigned_department
  ON public.civic_reports(assigned_department_id);

-- 3) Audit log table
CREATE TABLE IF NOT EXISTS public.report_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.civic_reports(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,                -- status_change | assignment_change | remarks_change
  field text,                          -- status | assigned_department_id | assigned_officer | admin_remarks
  old_value text,
  new_value text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_audit_logs_report
  ON public.report_audit_logs(report_id, created_at DESC);

ALTER TABLE public.report_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.report_audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON public.report_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own report audit logs" ON public.report_audit_logs;
CREATE POLICY "Users can view their own report audit logs"
  ON public.report_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.civic_reports r
      WHERE r.id = report_audit_logs.report_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.report_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.report_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Trigger to capture changes automatically
CREATE OR REPLACE FUNCTION public.log_report_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.report_audit_logs (report_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, _actor, 'status_change', 'status',
            COALESCE(OLD.status, ''), COALESCE(NEW.status, ''));
  END IF;

  IF NEW.assigned_department_id IS DISTINCT FROM OLD.assigned_department_id THEN
    INSERT INTO public.report_audit_logs (report_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, _actor, 'assignment_change', 'assigned_department_id',
            COALESCE(OLD.assigned_department_id::text, ''),
            COALESCE(NEW.assigned_department_id::text, ''));
  END IF;

  IF NEW.assigned_officer IS DISTINCT FROM OLD.assigned_officer THEN
    INSERT INTO public.report_audit_logs (report_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, _actor, 'assignment_change', 'assigned_officer',
            COALESCE(OLD.assigned_officer, ''), COALESCE(NEW.assigned_officer, ''));
  END IF;

  IF NEW.admin_remarks IS DISTINCT FROM OLD.admin_remarks THEN
    INSERT INTO public.report_audit_logs (report_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, _actor, 'remarks_change', 'admin_remarks',
            COALESCE(OLD.admin_remarks, ''), COALESCE(NEW.admin_remarks, ''));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_report_changes ON public.civic_reports;
CREATE TRIGGER trg_log_report_changes
AFTER UPDATE ON public.civic_reports
FOR EACH ROW EXECUTE FUNCTION public.log_report_changes();