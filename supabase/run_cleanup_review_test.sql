-- Leftovers of the /review test (19 Oct 2026), already hidden / blocked; delete once Jano says so.
-- (The connector cannot confirm destructive statements from the desktop app: run it in the Supabase SQL editor.)
delete from public.review_messages where author = 'zz-test-architect' or (origin = 'studio' and text like 'TEST zo Studia%');
delete from public.activity_log where actor in ('zz-test-review-admin', 'zz-test-architect');
delete from public.admin_users where username in ('zz-test-review-admin', 'zz-test-architect');   -- sessions and links go with them
-- and the test photo in Storage: bucket review, photos/e9b77727/1792433738145_534b43_test_foto.jpg (Storage → review → Delete)
