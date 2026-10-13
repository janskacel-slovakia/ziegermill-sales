-- URGENT (found 8 Oct 2026, applied 9 Oct): with the PUBLIC (publishable) key - it ships in the website's JavaScript -
-- anyone could
--   * read admin_users (incl. password_hash) and admin_sessions (live session tokens),
--   * insert / update / delete in units, unit_changes, admin_users and admin_sessions: the policies named
--     "Service role full access on ..." were granted to role public with `true`, i.e. to everyone,
--   * run create_admin_user / change_admin_password / verify_admin_login (security definer functions).
-- The server reaches all of these only with the service-role key (app/lib/admin-auth.ts, /api/admin/*), which bypasses
-- RLS - so the "service role" policies were never needed. After this the public can: read units, submit a lead.
-- Then: change the admin password (its hash was public).

alter table public.admin_users    enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.unit_changes   enable row level security;
alter table public.units          enable row level security;
alter table public.leads          enable row level security;

-- table rights for the public roles: nothing on the admin tables, read-only units, insert-only leads
revoke all on table public.admin_users, public.admin_sessions, public.unit_changes from anon, authenticated;
revoke insert, update, delete, truncate on table public.units from anon, authenticated;
revoke select, update, delete, truncate on table public.leads from anon, authenticated;
grant select on table public.units to anon, authenticated;
grant insert on table public.leads to anon, authenticated;

-- the admin functions: server only
revoke execute on function public.verify_admin_login(text, text)                  from public, anon, authenticated;
revoke execute on function public.create_admin_user(text, text, text, text)       from public, anon, authenticated;
revoke execute on function public.change_admin_password(integer, text)            from public, anon, authenticated;
grant  execute on function public.verify_admin_login(text, text)                  to service_role;
grant  execute on function public.create_admin_user(text, text, text, text)       to service_role;
grant  execute on function public.change_admin_password(integer, text)            to service_role;

-- APPLIED 9 Oct 2026 as migration "lock_admin_tables_grants" (verified from the public side: admin tables, change
-- history and leads "permission denied", units read-only, the three functions server-only, the contact form still
-- submits). The destructive cleanup (dropping the "Service role full access ..." policies, deleting sessions) is in
-- 20261009090000_cleanup_open_policies.sql: the Supabase connector cannot confirm destructive statements from the
-- desktop app. Without table rights those policies do nothing; the only session had expired on 31 Mar 2026.
