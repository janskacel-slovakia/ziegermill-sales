-- Dashboard settings (9 Oct 2026, Jano): sales waterfall, the agent's commission (Nidal offer "Cenova_ponuka_Zieger_Mill_
-- Nidal2.pdf": sale 1.25 % / 1.5 % for complicated cases, claims 0.25 %, all excl. VAT, of the property price;
-- marketing 2 500 - 5 000 EUR/month) and, for the admin only, profit. Server-only table; admin_only = hidden from agents.
-- APPLIED 9 Oct 2026 ("crm_dashboard_settings").
create table if not exists public.crm_settings (
  key        text primary key,
  value      jsonb not null,
  label      text,
  admin_only boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.crm_settings enable row level security;
revoke all on table public.crm_settings from anon, authenticated;
insert into public.crm_settings (key, value, label, admin_only) values
  ('commission_rate',         '0.0125', 'Provízia makléra – štandard (podľa ponuky Nidal 1,25 % bez DPH)', false),
  ('commission_rate_complex', '0.015',  'Provízia makléra – komplikovaný prípad (1,5 %)', false),
  ('claims_rate',             '0.0025', 'Reklamácie (0,25 % z ceny)', false),
  ('commission_base',         '"gross"', 'Základ provízie: kúpna cena s DPH (gross) alebo bez DPH (net) – overiť v zmluve s Nidal', false),
  ('commission_due_stage',    '"purchase_contract"', 'Provízia je zarobená od fázy', false),
  ('vat_rate',                '0.23',   'Sadzba DPH pri predaji (overiť s účtovníkom)', true),
  ('marketing_monthly',       '3500',   'Marketing €/mesiac bez DPH (ponuka Nidal 2 500 – 5 000)', true),
  ('marketing_months',        '18',     'Marketing – počet mesiacov', true),
  ('costs_total',             'null',   'Náklady projektu spolu bez DPH (kým nie je rozpočet)', true)
on conflict (key) do nothing;
-- per deal: 0.015 for a complicated case (set by the admin); null = the standard rate
alter table public.deals add column if not exists commission_rate numeric;
