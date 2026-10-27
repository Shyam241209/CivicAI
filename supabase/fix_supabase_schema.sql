BEGIN;

-- 1. Auth role table and helper functions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('user', 'admin');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY (role = 'admin') DESC LIMIT 1),
    'user'::public.app_role
  );
$$;

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
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

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

CREATE POLICY "Users can insert own role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own role"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own role"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2. Civic reports table, policies, triggers
CREATE TABLE IF NOT EXISTS public.civic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  user_description TEXT,
  location_data JSONB,
  issue_category TEXT,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'critical')),
  priority_level TEXT CHECK (priority_level IN ('low', 'medium', 'high')),
  short_description TEXT,
  suggested_department TEXT,
  context_analysis TEXT,
  estimated_resolution_time TEXT,
  recommended_action TEXT,
  ai_confidence_score DECIMAL(5,4),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  assigned_department_id UUID,
  auto_assign_suggested_name TEXT,
  auto_assign_match_method TEXT,
  auto_assign_confidence NUMERIC,
  auto_assign_pending_confirmation BOOLEAN,
  auto_assign_created_department BOOLEAN,
  admin_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.civic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.civic_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'user') AND auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON public.civic_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'user') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'user') AND auth.uid() = user_id);

CREATE POLICY "Admins can update all reports"
  ON public.civic_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all reports"
  ON public.civic_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own reports"
  ON public.civic_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'user') AND auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_civic_reports_updated_at ON public.civic_reports;
CREATE TRIGGER update_civic_reports_updated_at
  BEFORE UPDATE ON public.civic_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Notifications table and policies
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  report_id UUID REFERENCES public.civic_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- 4. Profiles table and policies
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  bio TEXT,
  address_line TEXT,
  city TEXT,
  district TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  region TEXT,
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  accent_color TEXT,
  font_size TEXT DEFAULT 'medium',
  compact_mode BOOLEAN DEFAULT FALSE,
  theme_preference TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Public reports table for map data
CREATE TABLE IF NOT EXISTS public.public_reports (
  id UUID PRIMARY KEY,
  status TEXT,
  issue_category TEXT,
  severity TEXT,
  priority_level TEXT,
  short_description TEXT,
  suggested_department TEXT,
  assigned_department_id UUID,
  location_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_reports TO authenticated;
GRANT SELECT ON public.public_reports TO anon;
GRANT ALL ON public.public_reports TO service_role;
ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymized public reports are readable"
  ON public.public_reports
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_sync_public_report ON public.civic_reports;
CREATE TRIGGER trg_sync_public_report
  AFTER INSERT OR UPDATE OR DELETE ON public.civic_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_public_report();

-- 6. Departments and system settings required by app
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  officer_name TEXT,
  contact_email TEXT,
  phone TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view departments"
  ON public.departments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert departments"
  ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete departments"
  ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_assign_confidence_threshold NUMERIC,
  auto_create_missing_departments BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system settings"
  ON public.system_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert system settings"
  ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update system settings"
  ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Backfill roles and profiles for existing auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

