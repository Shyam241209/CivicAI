-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to automatically create user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')::app_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Update RLS policies on civic_reports for role-based access
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.civic_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.civic_reports;

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.civic_reports
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'user') AND
  auth.uid() = user_id
);

-- Users can update their own reports
CREATE POLICY "Users can update own reports"
ON public.civic_reports
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'user') AND
  auth.uid() = user_id
);

-- Admins can update any report
CREATE POLICY "Admins can update all reports"
ON public.civic_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.civic_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON public.civic_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'user') AND
  auth.uid() = user_id
);