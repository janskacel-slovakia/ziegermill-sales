-- The price list and the flats' settings for the website (8 Oct 2026, Jano: "structure in supabase the price list and
-- all the settings for flats which will be pulled to the website"). Source: "Zieger cennik final 082026 LV.xlsx"
-- (37 units: ateliers A01-A34, flats B01-B03). The data comes from scripts/import_cennik.py, which turns the spreadsheet
-- into supabase/seed/cennik.sql - rerun it whenever the price list changes.
-- APPLIED 9 Oct 2026 ("price_list_structure"; data: "price_list_cennik_082026" = supabase/seed/cennik.sql).
-- Fitted to the live schema: unit_type is the enum flat | atelier | loft | penthouse, price_per_m2 a generated
-- column, status the enum available | reserved | sold | unavailable, units' select policy "Public can read units".

-- ---------------------------------------------------------------- units: the price list's fields + per-unit web settings
alter table public.units
  add column if not exists layout           text,      -- the list's "Typ": 'klasická' | 'loft'  (unit_type: atelier | flat)
  add column if not exists rooms_count      integer,   -- izbovosť (rooms keeps the label, e.g. '2-izb.')
  add column if not exists view_type        text,      -- výhľad: 'Matadorka' | 'dvor' | 'industrial'
  add column if not exists gallery_area     numeric,   -- galéria (lofts on 4.-5. NP, where the list gives it apart), m2
  add column if not exists total_area       numeric,   -- "Spolu": interiér + galéria + exteriér, m2
  add column if not exists area_with_podium numeric,   -- "výmera s pódiom" (4.-5. NP lofts), m2
  add column if not exists price_list       text,      -- the price list the price came from
  add column if not exists is_public        boolean not null default true,   -- shown on the website at all
  add column if not exists sort_order       integer,
  add column if not exists selector_id      text,      -- the 3D building selector's volume (a32, byt01 ...)
  add column if not exists walkthrough_url  text;      -- the unit's 3D walkthrough, e.g. /walk/a32/index.html

-- price per m2 from the total area ("Spolu"), as the price list's areas mean it; interior where no total is known
alter table public.units alter column price_per_m2 set expression as
  (case when coalesce(total_area, interior_area) > 0 then round(price / coalesce(total_area, interior_area), 2) end);

comment on column public.units.interior_area is 'Interiér from the price list (on 4.-5. NP lofts the lower level only; the gallery is in gallery_area)';
comment on column public.units.price_per_m2  is 'generated: price / total_area (or interior_area)';

-- the public reads only the units meant for the website
alter policy "Public can read units" on public.units using (is_public);

-- ---------------------------------------------------------------- site-wide settings the website reads
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  label      text,                                   -- what it is, for /admin (Slovak)
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
create policy "site_settings: public read" on public.site_settings for select to anon, authenticated using (true);

insert into public.site_settings (key, value, label) values
  ('show_prices',      'true',                            'Zobrazovať ceny na webe'),
  ('show_sold_prices', 'false',                           'Zobrazovať ceny predaných jednotiek'),
  ('price_list',       '"Zieger cenník final 08/2026"',   'Platný cenník'),
  ('vat_included',     'true',                            'Ceny sú uvedené s DPH'),
  ('price_note',       '"Všetky ceny sú uvedené s DPH."', 'Poznámka pod cenníkom'),
  ('currency',         '"EUR"',                           'Mena')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- the placeholder units (2A ... 6B) leave the website
-- (hidden, not deleted: the connector cannot confirm deletes; they can go with 20261009090000_cleanup_open_policies.sql)
update public.units set is_public = false, status = 'unavailable'
 where id in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');
