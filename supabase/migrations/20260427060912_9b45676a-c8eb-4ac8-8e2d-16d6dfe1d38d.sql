CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  officer_name TEXT,
  contact_email TEXT,
  phone TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert departments"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete departments"
  ON public.departments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.departments (name, officer_name, contact_email, phone, description) VALUES
  ('Public Works', 'PWD Officer', 'pwd@city.gov.in', '+91-1800-000-001', 'Roads, potholes, infrastructure'),
  ('Sanitation', 'Sanitation Officer', 'sanitation@city.gov.in', '+91-1800-000-002', 'Garbage collection and waste management'),
  ('Electricity', 'Electrical Officer', 'electricity@city.gov.in', '+91-1800-000-003', 'Streetlights and electrical issues'),
  ('Water', 'Water Officer', 'water@city.gov.in', '+91-1800-000-004', 'Water leaks and supply issues'),
  ('Road Department', 'Road Officer', 'roads@city.gov.in', '+91-1800-000-005', 'Road damage and traffic infrastructure');