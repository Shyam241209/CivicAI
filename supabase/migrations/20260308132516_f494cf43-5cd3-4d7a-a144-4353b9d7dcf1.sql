
CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    VALUES (
      NEW.user_id,
      'Report Status Updated',
      'Your report "' || COALESCE(NEW.short_description, 'Untitled') || '" status changed to ' || COALESCE(NEW.status, 'unknown') || '.',
      'status_change',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_report_status_change
  AFTER UPDATE ON public.civic_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_status_change();
