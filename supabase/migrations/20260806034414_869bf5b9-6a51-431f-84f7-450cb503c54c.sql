-- Backfill missing citizen roles so protected routes can resolve a role.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;

-- get_user_role never returns NULL for an existing account: default to citizen.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY (role = 'admin') DESC LIMIT 1),
    'user'::app_role
  )
$function$;