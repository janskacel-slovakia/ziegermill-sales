-- Paste this whole file into the Supabase SQL editor (Zieger Mill project) and Run. One transaction: all or nothing.
-- Removes the leftover policies (already harmless: they apply to the server role only) and deletes the 11 hidden
-- placeholder units (2A ... 6B) with their change history, and the expired admin session.
begin;
drop policy if exists "Service role full access on sessions" on public.admin_sessions;
drop policy if exists "Service role full access on admins"   on public.admin_users;
drop policy if exists "Service role full access on changes"  on public.unit_changes;
drop policy if exists "Service role full access on units"    on public.units;
drop policy if exists "Public can read unit_changes"         on public.unit_changes;
delete from public.unit_changes where unit_id in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');
delete from public.units        where id      in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');
delete from public.admin_sessions where expires_at < now();
commit;
