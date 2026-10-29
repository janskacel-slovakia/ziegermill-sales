-- Architect review: important points (29 Oct 2026, Jano: "can we mark some comments important with exclamation and bolder
-- number and heading?"). Set in the Studio's Architect tab (notes.json point "important": true), sent by review_sync.py.
-- APPLIED 29 Oct 2026 ("review_important", Jano: "yes").
alter table public.review_points add column if not exists important boolean not null default false;
