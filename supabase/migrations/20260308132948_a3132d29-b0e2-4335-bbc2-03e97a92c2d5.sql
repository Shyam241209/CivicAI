
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.user_id IS NOT NULL THEN
    -- Insert in-app notification
    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    VALUES (
      NEW.user_id,
      'Report Status Updated',
      'Your report "' || COALESCE(NEW.short_description, 'Untitled') || '" status changed to ' || COALESCE(NEW.status, 'unknown') || '.',
      'status_change',
      NEW.id
    );

    -- Call edge function for email notification
    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := _supabase_url || '/functions/v1/send-status-email',
        body := json_build_object(
          'user_id', NEW.user_id,
          'report_title', COALESCE(NEW.short_description, 'Untitled'),
          'new_status', COALESCE(NEW.status, 'unknown'),
          'report_id', NEW.id
        )::text,
        headers := json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        )::jsonb
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
