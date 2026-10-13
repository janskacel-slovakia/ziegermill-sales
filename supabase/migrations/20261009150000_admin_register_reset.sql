-- /admin self-registration (with the admin's approval) and "forgot password" (9 Oct 2026, Jano).
-- A registration creates an inactive agent account (requested_at set); Jano approves it in Používatelia
-- (approved_at, is_active). Reset links: one-time tokens, stored only as their sha256 hash, valid 1 hour.
-- APPLIED 9 Oct 2026 ("admin_register_reset").

alter table public.admin_users
  add column if not exists requested_at timestamptz,     -- registered on the login page (pending until approved)
  add column if not exists approved_at  timestamptz,
  add column if not exists approved_by  text;

create table if not exists public.password_resets (
  token_hash text primary key,                          -- sha256 of the emailed token
  user_id    integer not null references public.admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user on public.password_resets (user_id, created_at desc);
alter table public.password_resets enable row level security;
revoke all on table public.password_resets from anon, authenticated;
