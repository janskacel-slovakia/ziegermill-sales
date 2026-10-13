-- Sales CRM for /admin (9 Oct 2026, Jano: "kind of CRM tool for real estate project").
-- Two roles in admin_users.role: 'admin' (Jano: everything) and 'agent' (the real estate agent: status, reservations,
-- clients, deals, documents, templates - not prices, areas or users). Everything here is server-only (the /api/admin
-- routes use the service-role key and check the role); the public reads only parking_spaces' plain columns.
-- APPLIED 9 Oct 2026 ("crm"; the role update below was a no-op and left out). Data: supabase/seed/parking.sql (scripts/parking_from_pdf.py).

-- ---------------------------------------------------------------- users: roles + the agent's contact for emails
alter table public.admin_users
  add column if not exists email text,           -- sender address for emails to clients (e.g. the agent's own)
  add column if not exists phone text;           -- for the email signature
update public.admin_users set role = 'admin' where role is null or role not in ('admin', 'agent');
alter table public.admin_users add constraint admin_users_role_check check (role in ('admin', 'agent'));

-- ---------------------------------------------------------------- one log for everything the CRM changes
create table if not exists public.activity_log (
  id         bigserial primary key,
  entity     text not null,                      -- unit | parking | deal | customer | template | document | user
  entity_id  text not null,
  action     text not null,                      -- create | update | delete | upload | stage | email ...
  field      text,
  old_value  text,
  new_value  text,
  note       text,
  actor      text,                               -- admin_users.username
  at         timestamptz not null default now()
);
create index if not exists activity_log_entity on public.activity_log (entity, entity_id, at desc);

-- ---------------------------------------------------------------- parking: price list + availability, like units
create table if not exists public.parking_spaces (
  id          text primary key,                  -- G01-G42 garage (numbers of E.1), E01-E24 outdoor
  kind        text not null check (kind in ('garage', 'outdoor')),
  number      integer not null,
  label       text not null,
  plan        text not null,                     -- which plan image: garaz | exterier (public/parking/plans.json)
  shape       jsonb,                             -- outline on that image, [[x, y], ...] in its pixels
  accessible  boolean not null default false,    -- wide space (bezbariérové)
  price       numeric,
  status      public.unit_status not null default 'available',
  is_public   boolean not null default true,
  sort_order  integer,
  notes       text,                              -- internal
  updated_at  timestamptz not null default now()
);
create trigger parking_spaces_updated_at before update on public.parking_spaces
  for each row execute function public.update_updated_at();
alter table public.parking_spaces enable row level security;
revoke all on table public.parking_spaces from anon, authenticated;
grant select (id, kind, number, label, plan, shape, accessible, price, status, is_public, sort_order)
  on table public.parking_spaces to anon, authenticated;
create policy "parking: public read" on public.parking_spaces for select to anon, authenticated using (is_public);

-- ---------------------------------------------------------------- clients
create table if not exists public.customers (
  id                     uuid primary key default gen_random_uuid(),
  kind                   text not null default 'person' check (kind in ('person', 'company')),
  title                  text,
  first_name             text,
  last_name              text,
  birth_surname          text,
  birth_date             date,
  birth_number           text,                   -- rodné číslo (contracts only)
  nationality            text,
  address                text,                   -- trvalý pobyt / sídlo
  correspondence_address text,
  email                  text,
  phone                  text,
  iban                   text,
  company_name           text,
  ico                    text,
  dic                    text,
  ic_dph                 text,
  registry               text,                   -- zápis v OR
  statutory              text,                   -- štatutárny orgán
  lead_id                bigint references public.leads(id) on delete set null,
  source                 text,                   -- web | telefón | odporúčanie ...
  notes                  text,
  created_by             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------- deals: one client (or couple) x one unit
create table if not exists public.deals (
  id                    uuid primary key default gen_random_uuid(),
  unit_id               text not null references public.units(id) on delete restrict,
  stage                 text not null default 'offer' check (stage in
                          ('interest', 'offer', 'reserved', 'future_contract', 'purchase_contract', 'sold', 'cancelled')),
  agent_id              integer references public.admin_users(id) on delete set null,
  list_price            numeric,                 -- the price list's price when the deal started
  price                 numeric,                 -- agreed price of the unit (parking in deal_parking)
  reservation_fee       numeric default 5000,
  reserved_at           date,
  reserved_until        date,
  future_contract_at    date,
  purchase_contract_at  date,
  notes                 text,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz
);
create trigger deals_updated_at before update on public.deals
  for each row execute function public.update_updated_at();
-- many offers on one unit are fine, but only one deal can hold it (reserved and further)
create unique index if not exists deals_one_holder on public.deals (unit_id)
  where stage in ('reserved', 'future_contract', 'purchase_contract', 'sold');
create index if not exists deals_unit on public.deals (unit_id);

create table if not exists public.deal_customers (
  deal_id     uuid not null references public.deals(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  role        text not null default 'buyer' check (role in ('buyer', 'contact')),
  position    integer not null default 1,
  primary key (deal_id, customer_id)
);
create table if not exists public.deal_parking (
  deal_id    uuid not null references public.deals(id) on delete cascade,
  parking_id text not null references public.parking_spaces(id) on delete restrict,
  price      numeric,
  primary key (deal_id, parking_id)
);

-- ---------------------------------------------------------------- documents: generic templates + per-deal files
create table if not exists public.doc_templates (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('RZ', 'ZBKZ', 'KZ', 'standard', 'annex', 'other')),
  title        text not null,
  version      text,
  storage_path text not null,                    -- bucket 'crm'
  file_name    text not null,
  mime         text,
  size         bigint,
  is_current   boolean not null default true,    -- the one used for new deals (one per kind+title)
  notes        text,
  uploaded_by  text,
  uploaded_at  timestamptz not null default now()
);
create table if not exists public.deal_documents (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  kind         text not null,                    -- RZ | ZBKZ | KZ | standard | annex | other
  title        text not null,
  source       text not null default 'custom' check (source in ('template', 'generated', 'custom', 'signed', 'customer')),
  template_id  uuid references public.doc_templates(id) on delete set null,
  storage_path text not null,
  file_name    text not null,
  mime         text,
  size         bigint,
  notes        text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists deal_documents_deal on public.deal_documents (deal_id, created_at desc);

-- ---------------------------------------------------------------- server only
do $$
declare t text;
begin
  foreach t in array array['activity_log', 'customers', 'deals', 'deal_customers', 'deal_parking', 'doc_templates',
                           'deal_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.activity_log_id_seq from anon, authenticated;

-- private file store (templates, generated and signed contracts); no storage policies = server only
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm', 'crm', false, 52428800)
on conflict (id) do nothing;
