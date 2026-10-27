-- Department staff memberships. This runs before 20260901000000, which references this table.

CREATE TABLE IF NOT EXISTS public.department_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

ALTER TABLE public.department_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS department_users_user_id_idx ON public.department_users(user_id);
CREATE INDEX IF NOT EXISTS department_users_department_id_idx ON public.department_users(department_id);
CREATE INDEX IF NOT EXISTS department_users_active_idx ON public.department_users(user_id, department_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.update_department_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS department_users_updated_at ON public.department_users;
CREATE TRIGGER department_users_updated_at
  BEFORE UPDATE ON public.department_users
  FOR EACH ROW EXECUTE FUNCTION public.update_department_users_updated_at();

CREATE OR REPLACE FUNCTION public.is_department_staff(
  p_user_id uuid,
  p_department_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_users du
    WHERE du.user_id = p_user_id
      AND du.department_id = p_department_id
      AND du.status = 'active'
  );
$$;

CREATE POLICY "Admins can manage department staff"
  ON public.department_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Staff can view their own department memberships"
  ON public.department_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.civic_reports
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS civic_reports_assigned_staff_idx
  ON public.civic_reports(assigned_staff_id);

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ur.role
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
      ORDER BY CASE ur.role
        WHEN 'admin'::public.app_role THEN 0
        WHEN 'staff'::public.app_role THEN 1
        ELSE 2
      END
      LIMIT 1
    ),
    'user'::public.app_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_department_staff(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
