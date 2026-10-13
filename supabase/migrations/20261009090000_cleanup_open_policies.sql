-- APPLIED 9 Oct 2026 as migration "narrow_service_role_policies" (the non-destructive form of the cleanup): the policies
-- that were granted to everyone ("public", `true`) now apply to service_role only - which RLS skips anyway. Without this
-- the bogus "Service role full access on units" let the public read the hidden placeholder units too.
alter policy "Service role full access on sessions" on public.admin_sessions to service_role;
alter policy "Service role full access on admins"   on public.admin_users    to service_role;
alter policy "Service role full access on changes"  on public.unit_changes   to service_role;
alter policy "Service role full access on units"    on public.units          to service_role;
alter policy "Public can read unit_changes"         on public.unit_changes   to service_role;

-- PENDING, optional (destructive - the connector cannot confirm it from the desktop app; SQL editor, or later):
-- drop policy "Service role full access on sessions" on public.admin_sessions;
-- drop policy "Service role full access on admins"   on public.admin_users;
-- drop policy "Service role full access on changes"  on public.unit_changes;
-- drop policy "Service role full access on units"    on public.units;
-- drop policy "Public can read unit_changes"         on public.unit_changes;
-- delete from public.units where id in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');   -- hidden placeholders
-- (their unit_changes rows first: delete from public.unit_changes where unit_id in (...same ids...);)
-- delete from public.admin_sessions where expires_at < now();
-- Also open: the five public functions have a mutable search_path (Supabase advisor 0011). Pin it only after checking
-- which schema verify_admin_login's crypt() lives in, or /admin login breaks.
