-- Paste into the Supabase SQL editor (Zieger Mill project) and Run. Removes what Claude's admin test of 9 Oct 2026
-- left behind (the connector cannot run deletes from the desktop app): the disabled test admin, the hidden test
-- unit TEST1 and the test entries in the change log. Real data is not touched.
begin;
delete from public.activity_log where actor in ('claude_test_admin', 'claude_test_agent@example.test', 'reset')
   or (entity = 'unit' and entity_id = 'TEST1') or (entity = 'user' and entity_id in ('3', '4'));
delete from public.admin_sessions where user_id = 3;
delete from public.admin_users where id = 3 and username = 'claude_test_admin';
delete from public.units where id = 'TEST1';
commit;
