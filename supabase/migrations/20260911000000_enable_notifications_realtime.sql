-- The notifications table migration may already be marked applied on older projects
-- without the publication entry. Add the missing realtime membership idempotently.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
