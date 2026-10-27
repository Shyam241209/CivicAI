REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_report_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_reports() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reports() TO authenticated;