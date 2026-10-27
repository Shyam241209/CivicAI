CREATE INDEX IF NOT EXISTS idx_civic_reports_user_created ON public.civic_reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_reports_created_at ON public.civic_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_reports_status ON public.civic_reports (status);
CREATE INDEX IF NOT EXISTS idx_civic_reports_department ON public.civic_reports (assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_report_audit_logs_report ON public.report_audit_logs (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);