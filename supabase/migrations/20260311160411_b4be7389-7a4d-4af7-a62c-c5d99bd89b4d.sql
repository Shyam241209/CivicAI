
-- Table for scheduled report configurations
CREATE TABLE public.scheduled_report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamp with time zone,
  next_run_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for generated reports
CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS for scheduled_report_configs (admin only)
CREATE POLICY "Admins can manage their own report configs"
  ON public.scheduled_report_configs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id);

-- RLS for generated_reports (admin only)
CREATE POLICY "Admins can view their own reports"
  ON public.generated_reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id);

CREATE POLICY "System can insert reports for admins"
  ON public.generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_report_configs_updated_at
  BEFORE UPDATE ON public.scheduled_report_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
