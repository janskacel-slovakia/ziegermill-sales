-- 8 Oct 2026: ONE paste for the Supabase SQL editor (Zieger Mill project). Runs in one transaction: all or nothing.
-- = migrations/20261008180000_lock_admin_tables.sql + migrations/20261008180100_price_list_structure.sql + seed/cennik.sql
begin;

-- URGENT (8 Oct 2026): the admin tables are readable with the PUBLIC (publishable) key, which ships in the website's
-- own JavaScript. Anyone could read admin_users (incl. password_hash) and admin_sessions (live session tokens -> act
-- as the admin in /admin and change prices / statuses). Found while structuring the price list; no values were read.
--
-- The server code reaches these tables only with the service-role key (app/lib/admin-auth.ts), which bypasses RLS,
-- so turning RLS on with no public policies locks the public out without touching /admin.
-- Run this in the Supabase SQL editor (project ghensb...), then:
--   * log in to /admin again (all sessions are dropped below - a leaked token stops working),
--   * change the admin password (its hash was public).

alter table public.admin_users    enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.unit_changes   enable row level security;
alter table public.leads          enable row level security;

-- belt and braces: no table rights at all for the public roles on the admin tables
revoke all on table public.admin_users    from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
revoke all on table public.unit_changes   from anon, authenticated;

-- leads: the website's contact form inserts with the public key (app/page.tsx) - keep exactly that, nothing else
revoke all on table public.leads from anon, authenticated;
grant insert on table public.leads to anon, authenticated;
drop policy if exists "leads: public can submit" on public.leads;
create policy "leads: public can submit" on public.leads for insert to anon, authenticated with check (true);

-- every session token that may have leaked stops working now
delete from public.admin_sessions;

-- The price list and the flats' settings for the website (8 Oct 2026, Jano: "structure in supabase the price list and
-- all the settings for flats which will be pulled to the website"). Source: "Zieger cennik final 082026 LV.xlsx"
-- (37 units: ateliers A01-A34, flats B01-B03). The data itself comes from scripts/import_cennik.py, which turns the
-- spreadsheet into supabase/seed/cennik.sql - rerun it whenever the price list changes.
-- Run after 20261008180000_lock_admin_tables.sql.

-- ---------------------------------------------------------------- units: the price list's fields + per-unit web settings
alter table public.units
  add column if not exists kind             text,      -- 'ateliér' (nebytový priestor) | 'byt'
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
-- unit_type now carries the price list's "Typ" ('klasická' | 'loft'); orientation the Slovak abbreviation (V, JV, SZ ...)

comment on column public.units.interior_area is 'Interiér from the price list (on 4.-5. NP lofts the lower level only; the gallery is in gallery_area)';
comment on column public.units.price_per_m2  is 'price / total_area (site_settings.price_per_m2_basis)';

-- the public reads units, never writes them (writes go through /admin with the service-role key)
alter table public.units enable row level security;
revoke insert, update, delete, truncate on table public.units from anon, authenticated;
grant select on table public.units to anon, authenticated;
drop policy if exists "units: public read" on public.units;
create policy "units: public read" on public.units for select to anon, authenticated using (is_public);

-- ---------------------------------------------------------------- site-wide settings the website reads
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  label      text,                                   -- what it is, for /admin (Slovak)
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke insert, update, delete, truncate on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
drop policy if exists "site_settings: public read" on public.site_settings;
create policy "site_settings: public read" on public.site_settings for select to anon, authenticated using (true);

insert into public.site_settings (key, value, label) values
  ('show_prices',        'true',                                   'Zobrazovať ceny na webe'),
  ('show_sold_prices',   'false',                                  'Zobrazovať ceny predaných jednotiek'),
  ('price_list',         '"Zieger cenník final 08/2026"',          'Platný cenník'),
  ('vat_included',       'true',                                   'Ceny sú uvedené s DPH'),
  ('price_note',         '"Všetky ceny sú uvedené s DPH."',        'Poznámka pod cenníkom'),
  ('price_per_m2_basis', '"total_area"',                           'Cena za m² sa počíta z: total_area (Spolu) alebo interior_area'),
  ('currency',           '"EUR"',                                  'Mena')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- the placeholder units go (2A ... 6B, never real)
delete from public.unit_changes where unit_id in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');
delete from public.units        where id      in ('2A','2B','3A','3B','4A','4B','5A','5B','5C','6A','6B');

-- generated by scripts/import_cennik.py from 'Zieger cennik final 082026  LV.xlsx', 2026-10-08 - do not edit, rerun the script
-- 37 units, total 10 161 700 EUR
insert into public.units (id, name, kind, unit_type, floor_number, rooms_count, rooms, view_type, interior_area, gallery_area, exterior_area, exterior_type, total_area, area_with_podium, orientation, price, price_per_m2, price_list, sort_order, selector_id, walkthrough_url, status) values
  ('A01', 'Ateliér 01', 'ateliér', 'klasická', 2, 1, '1-izb.', 'Matadorka', 38.62, 0.0, 0.0, null, 38.62, null, 'JV', 195400, 5059.55, 'Zieger cennik final 082026  LV', 1, 'a01', null, 'available'),
  ('A02', 'Ateliér 02', 'ateliér', 'klasická', 2, 1, '1-izb.', 'dvor', 38.3, 0.0, 0.0, null, 38.3, null, 'V', 191600, 5002.61, 'Zieger cennik final 082026  LV', 2, 'a02', null, 'available'),
  ('A03', 'Ateliér 03', 'ateliér', 'klasická', 2, 1, '1-izb.', 'dvor', 37.0, 0.0, 0.0, null, 37.0, null, 'V', 187300, 5062.16, 'Zieger cennik final 082026  LV', 3, 'a03', null, 'available'),
  ('A04', 'Ateliér 04', 'ateliér', 'klasická', 2, 1, '1-izb.', 'dvor', 38.28, 0.0, 0.0, null, 38.28, null, 'V', 190900, 4986.94, 'Zieger cennik final 082026  LV', 4, 'a04', null, 'available'),
  ('A05', 'Ateliér 05', 'ateliér', 'klasická', 2, 2, '2-izb.', 'dvor', 55.95, 0.0, 0.0, null, 55.95, null, 'V', 224100, 4005.36, 'Zieger cennik final 082026  LV', 5, 'a05', null, 'available'),
  ('A06', 'Ateliér 06', 'ateliér', 'klasická', 3, 1, '1-izb.', 'Matadorka', 38.61, 0.0, 0.0, null, 38.61, null, 'JV', 198800, 5148.93, 'Zieger cennik final 082026  LV', 6, 'a06', null, 'available'),
  ('A07', 'Ateliér 07', 'ateliér', 'klasická', 3, 1, '1-izb.', 'dvor', 38.29, 0.0, 0.0, null, 38.29, null, 'V', 194900, 5090.1, 'Zieger cennik final 082026  LV', 7, 'a07', null, 'available'),
  ('A08', 'Ateliér 08', 'ateliér', 'klasická', 3, 1, '1-izb.', 'dvor', 37.0, 0.0, 0.0, null, 37.0, null, 'V', 192500, 5202.7, 'Zieger cennik final 082026  LV', 8, 'a08', null, 'available'),
  ('A09', 'Ateliér 09', 'ateliér', 'klasická', 3, 1, '1-izb.', 'dvor', 38.28, 0.0, 0.0, null, 38.28, null, 'V', 194900, 5091.43, 'Zieger cennik final 082026  LV', 9, 'a09', null, 'available'),
  ('A10', 'Ateliér 10', 'ateliér', 'klasická', 3, 3, '3-izb.', 'dvor', 83.5, 0.0, 0.0, null, 83.5, null, 'V', 385100, 4611.98, 'Zieger cennik final 082026  LV', 10, 'a10', null, 'available'),
  ('A11', 'Ateliér 11', 'ateliér', 'klasická', 3, 2, '2-izb.', 'industrial', 51.64, 0.0, 3.42, 'balkón', 55.06, null, 'V', 215300, 3910.28, 'Zieger cennik final 082026  LV', 11, 'a11', null, 'available'),
  ('A12', 'Ateliér 12', 'ateliér', 'klasická', 3, 1, '1-izb.', 'industrial', 32.69, 0.0, 3.42, 'balkón', 36.11, null, 'SZ', 185800, 5145.39, 'Zieger cennik final 082026  LV', 12, 'a12', null, 'available'),
  ('A13', 'Ateliér 13', 'ateliér', 'klasická', 3, 2, '2-izb.', 'industrial', 44.42, 0.0, 3.42, 'balkón', 47.84, null, 'V', 211400, 4418.9, 'Zieger cennik final 082026  LV', 13, 'a13', null, 'available'),
  ('A14', 'Ateliér 14', 'ateliér', 'loft', 4, 3, '3-izb.', 'Matadorka', 44.2, 25.89, 5.6, 'balkón', 75.69, 70.09, 'JZ', 276500, 3653.06, 'Zieger cennik final 082026  LV', 14, 'a14', null, 'available'),
  ('A15', 'Ateliér 15', 'ateliér', 'loft', 4, 2, '2-izb.', 'dvor', 43.88, 23.71, 5.6, 'balkón', 73.19, 67.59, 'JV', 248000, 3388.44, 'Zieger cennik final 082026  LV', 15, 'a15', null, 'available'),
  ('A16', 'Ateliér 16', 'ateliér', 'loft', 4, 2, '2-izb.', 'dvor', 37.0, 28.08, 0.0, null, 65.08, 65.08, 'V', 220000, 3380.45, 'Zieger cennik final 082026  LV', 16, 'a16', null, 'available'),
  ('A17', 'Ateliér 17', 'ateliér', 'loft', 4, 2, '2-izb.', 'dvor', 43.87, 24.24, 5.6, 'balkón', 73.71, 68.11, 'V', 248000, 3364.54, 'Zieger cennik final 082026  LV', 17, 'a17', null, 'available'),
  ('A18', 'Ateliér 18', 'ateliér', 'loft', 4, 2, '2-izb.', 'dvor', 41.47, 22.95, 5.6, 'balkón', 70.02, 64.42, 'V', 241000, 3441.87, 'Zieger cennik final 082026  LV', 18, 'a18', null, 'available'),
  ('A19', 'Ateliér 19', 'ateliér', 'loft', 4, 2, '2-izb.', 'dvor', 53.18, 25.7, 5.6, 'balkón', 84.48, 78.88, 'V', 285000, 3373.58, 'Zieger cennik final 082026  LV', 19, 'a19', null, 'available'),
  ('A20', 'Ateliér 20', 'ateliér', 'loft', 4, 3, '3-izb.', 'industrial', 51.45, 33.48, 3.42, 'balkón', 88.35, 84.93, 'V', 281500, 3186.19, 'Zieger cennik final 082026  LV', 20, 'a20', null, 'available'),
  ('A21', 'Ateliér 21', 'ateliér', 'loft', 4, 2, '2-izb.', 'industrial', 32.69, 17.59, 3.42, 'balkón', 53.7, 50.28, 'SZ', 218000, 4059.59, 'Zieger cennik final 082026  LV', 21, 'a21', null, 'available'),
  ('A22', 'Ateliér 22', 'ateliér', 'loft', 4, 2, '2-izb.', 'industrial', 45.13, 24.79, 3.42, 'balkón', 73.34, 69.92, 'Z', 241000, 3286.06, 'Zieger cennik final 082026  LV', 22, 'a22', null, 'available'),
  ('A23', 'Ateliér 23', 'ateliér', 'loft', 5, 3, '3-izb.', 'Matadorka', 44.2, 26.22, 5.6, 'balkón', 76.02, 70.42, 'JZ', 280500, 3689.82, 'Zieger cennik final 082026  LV', 23, 'a23', null, 'available'),
  ('A24', 'Ateliér 24', 'ateliér', 'loft', 5, 2, '2-izb.', 'dvor', 43.95, 23.25, 5.6, 'balkón', 72.8, 67.2, 'JV', 253000, 3475.27, 'Zieger cennik final 082026  LV', 24, 'a24', null, 'available'),
  ('A25', 'Ateliér 25', 'ateliér', 'loft', 5, 2, '2-izb.', 'dvor', 42.6, 14.08, 5.6, 'balkón', 62.28, 56.68, 'V', 237000, 3805.39, 'Zieger cennik final 082026  LV', 25, 'a25', '/walk/a25/index.html', 'available'),
  ('A26', 'Ateliér 26', 'ateliér', 'loft', 5, 2, '2-izb.', 'dvor', 43.87, 15.69, 5.6, 'balkón', 65.16, 59.56, 'V', 240000, 3683.24, 'Zieger cennik final 082026  LV', 26, 'a26', null, 'available'),
  ('A27', 'Ateliér 27', 'ateliér', 'loft', 5, 2, '2-izb.', 'dvor', 41.46, 22.71, 5.6, 'balkón', 69.77, 64.17, 'V', 251000, 3597.53, 'Zieger cennik final 082026  LV', 27, 'a27', null, 'available'),
  ('A28', 'Ateliér 28', 'ateliér', 'loft', 5, 2, '2-izb.', 'Matadorka', 53.21, 16.17, 5.6, 'balkón', 74.98, 69.38, 'V', 285000, 3801.01, 'Zieger cennik final 082026  LV', 28, 'a28', null, 'available'),
  ('A29', 'Ateliér 29', 'ateliér', 'loft', 5, 3, '3-izb.', 'industrial', 46.13, 31.63, 3.42, 'balkón', 81.18, 77.76, 'SV', 280500, 3455.28, 'Zieger cennik final 082026  LV', 29, 'a29', null, 'available'),
  ('A30', 'Ateliér 30', 'ateliér', 'loft', 5, 2, '2-izb.', 'industrial', 32.69, 15.93, 3.42, 'balkón', 52.04, 48.62, 'SZ', 225000, 4323.6, 'Zieger cennik final 082026  LV', 30, 'a30', null, 'available'),
  ('A31', 'Ateliér 31', 'ateliér', 'loft', 5, 2, '2-izb.', 'industrial', 45.13, 24.51, 3.42, 'balkón', 73.06, 69.64, 'Z', 249000, 3408.16, 'Zieger cennik final 082026  LV', 31, 'a31', null, 'available'),
  ('A32', 'Ateliér 32', 'ateliér', 'loft', 6, 2, '2-izb.', 'dvor', 71.02, 0.0, 5.6, 'balkón', 76.62, null, 'V', 338400, 4416.6, 'Zieger cennik final 082026  LV', 32, 'a32', '/walk/a32/index.html', 'available'),
  ('A33', 'Ateliér 33', 'ateliér', 'loft', 6, 2, '2-izb.', 'dvor', 73.86, 0.0, 5.6, 'balkón', 79.46, null, 'V', 346100, 4355.65, 'Zieger cennik final 082026  LV', 33, 'a33', null, 'available'),
  ('A34', 'Ateliér 34', 'ateliér', 'loft', 6, 3, '3-izb.', 'industrial', 78.2, 0.0, 3.42, 'balkón', 81.62, null, 'Z', 352100, 4313.89, 'Zieger cennik final 082026  LV', 34, 'a34', null, 'available'),
  ('B01', 'Byt 01', 'byt', 'loft', 6, 4, '4-izb.', 'Matadorka', 151.9, 0.0, 9.64, 'balkón', 161.54, null, 'JV', 637100, 3943.91, 'Zieger cennik final 082026  LV', 35, 'byt01', '/walk/byt01/index.html', 'available'),
  ('B02', 'Byt 02', 'byt', 'loft', 6, 4, '4-izb.', 'Matadorka', 142.23, 0.0, 11.2, 'balkón', 153.43, null, 'SV', 613000, 3995.31, 'Zieger cennik final 082026  LV', 36, 'byt02', null, 'available'),
  ('B03', 'Byt 03', 'byt', 'loft', 6, 4, '4-izb.', 'industrial', 118.73, 0.0, 6.84, 'balkón', 125.57, null, 'JZ', 547000, 4356.14, 'Zieger cennik final 082026  LV', 37, 'byt03', null, 'available')
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  unit_type = excluded.unit_type,
  floor_number = excluded.floor_number,
  rooms_count = excluded.rooms_count,
  rooms = excluded.rooms,
  view_type = excluded.view_type,
  interior_area = excluded.interior_area,
  gallery_area = excluded.gallery_area,
  exterior_area = excluded.exterior_area,
  exterior_type = excluded.exterior_type,
  total_area = excluded.total_area,
  area_with_podium = excluded.area_with_podium,
  orientation = excluded.orientation,
  price = excluded.price,
  price_per_m2 = excluded.price_per_m2,
  price_list = excluded.price_list,
  sort_order = excluded.sort_order,
  selector_id = excluded.selector_id,
  walkthrough_url = coalesce(public.units.walkthrough_url, excluded.walkthrough_url),
  updated_at = now();

commit;
