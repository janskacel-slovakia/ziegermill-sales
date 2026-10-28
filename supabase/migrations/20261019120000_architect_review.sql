-- Architect review (19 Oct 2026, Jano: "he can open the floor plans with comments and when he clicks the number it will
-- open on new tab 3D model on that particular place ... architect should be able to reply ... there shouldn't be
-- complicated login for him"). Page /review, API /api/review/*.
-- - Role 'architect' in admin_users: sees and writes only the review (the server enforces it: requireUser() refuses
--   it everywhere in /api/admin, requireReviewer() admits admin + architect).
-- - review_links: the architect's personal link (/review#k=<token>), 90 days, no password; Jano revokes or reissues
--   it in /admin -> Používatelia. Opening it starts a normal admin_sessions session (cookie review_token).
-- - review_points: the Studio's _architect\notes.json points (id = the Studio's id), with the 3D view and the still.
-- - review_messages: the thread; by = 'user' (Jano) | 'claude' | 'architect', as the Studio's data.thread.
-- - Storage bucket 'review' (private): stills/<point id>.jpg, photos/<point id>/<file>; signed URLs only.
-- Everything is server-only (service-role key), like the CRM: no rights for anon / authenticated.
-- APPLIED 19 Oct 2026 ("architect_review", Jano: "yes").

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('admin', 'agent', 'architect'));

create table if not exists public.review_links (
  token        text primary key,                       -- 48 random bytes, hex; the link is /review#k=<token>
  user_id      integer not null references public.admin_users(id) on delete cascade,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  created_by   text,
  last_used_at timestamptz
);
create index if not exists review_links_user on public.review_links (user_id, created_at desc);

create table if not exists public.review_points (
  id          text primary key,                        -- the Studio's point id (notes.json "id")
  n           integer not null,                        -- the number on the sheet
  date        date,
  unit        text,
  page        integer,                                 -- page of the tender drawing set
  plan        text not null,                           -- sheet: 1PP, 1NP ... 6NP, 6NPm
  at          jsonb not null,                          -- [x, y] DXF metres
  title       text not null default '',
  text        text not null default '',
  source      text,
  view        jsonb,                                   -- {kind: flat|common|exterior, flat, cam {x,z,feet,yaw,pitch}, pos [u,h,v], note}
  still_path  text,                                    -- in bucket 'review'
  still_pin   jsonb,                                   -- [x, y] 0..1: where the point is in the still
  status      text not null default 'open' check (status in ('open', 'answered', 'agreed', 'done')),
  status_at   timestamptz not null default now(),
  status_by   text,
  studio_at   timestamptz,                             -- the Studio's time of the title / text / position sent last
  deleted_at  timestamptz,                             -- removed in the Studio
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists review_points_plan on public.review_points (plan, n);

create table if not exists public.review_messages (
  id          uuid primary key default gen_random_uuid(),
  point_id    text not null references public.review_points(id) on delete cascade,
  by          text not null check (by in ('user', 'claude', 'architect')),
  author      text,                                    -- admin_users.username (web) or 'studio'
  text        text not null default '',
  photos      jsonb not null default '[]'::jsonb,      -- [{path, name, w, h}] in bucket 'review'
  origin      text not null default 'web' check (origin in ('web', 'studio')),
  studio_key  text unique,                             -- a Studio thread entry's key, so a sync never doubles it
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists review_messages_point on public.review_messages (point_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['review_links', 'review_points', 'review_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- private file store for the review; no storage policies = server only (signed URLs)
insert into storage.buckets (id, name, public, file_size_limit)
values ('review', 'review', false, 20971520)
on conflict (id) do nothing;
