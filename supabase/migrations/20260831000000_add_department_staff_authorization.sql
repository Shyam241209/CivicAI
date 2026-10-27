-- Add the staff role in its own migration transaction. The following migration
-- creates department_users and can safely use this enum value.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
