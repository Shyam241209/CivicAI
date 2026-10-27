
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view templates"
  ON public.notification_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert templates"
  ON public.notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.notification_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
  ON public.notification_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default templates
INSERT INTO public.notification_templates (template_key, title, body, description) VALUES
  ('status_pending', 'Report Received', 'Your report "{{report_title}}" has been received and is pending review.', 'Sent when a new report is submitted'),
  ('status_in_progress', 'Report Under Review', 'Your report "{{report_title}}" is now being reviewed by our team.', 'Sent when report status changes to in_progress'),
  ('status_resolved', 'Report Resolved', 'Your report "{{report_title}}" has been resolved. Thank you for your contribution!', 'Sent when report status changes to resolved'),
  ('welcome_user', 'Welcome to CivicAI', 'Welcome! You can now report civic issues and track their resolution in real-time.', 'Sent to new users after signup'),
  ('admin_alert', 'New High Priority Report', 'A new high-priority {{category}} issue has been reported at {{location}}.', 'Sent to admins for high-priority reports');
