import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, logActivity } from '@/app/lib/admin-auth';

// Sales dashboard. Everything is computed here so the agent never receives the admin-only figures (profit, costs,
// VAT, marketing). Phases, from the furthest: sold, purchase_contract (KZ), future_contract (ZBKZ), reserved (RZ),
// then the free stock at list prices; together = the forecast revenue (units + priced parking, with VAT).
const PHASES = ['sold', 'purchase_contract', 'future_contract', 'reserved'] as const;
type Phase = typeof PHASES[number] | 'free';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const isAdmin = user.role === 'admin';
  const sb = getSupabaseAdmin();

  const [unitsR, spacesR, dealsR, setR] = await Promise.all([
    sb.from('units').select('id, name, price, status, is_public').eq('is_public', true),
    sb.from('parking_spaces').select('id, price, status, is_public'),
    sb.from('deals').select('id, unit_id, stage, price, list_price, commission_rate, updated_at, deal_parking(parking_id, price)').neq('stage', 'cancelled'),
    sb.from('crm_settings').select('key, value, label, admin_only'),
  ]);
  const S: Record<string, any> = Object.fromEntries((setR.data || []).map(s => [s.key, s.value]));
  const vat = Number(S.vat_rate ?? 0.23);
  const std = Number(S.commission_rate ?? 0.0125);
  const claimsRate = Number(S.claims_rate ?? 0.0025);
  const base = (gross: number) => (S.commission_base === 'net' ? gross / (1 + vat) : gross);
  const dueIdx = PHASES.indexOf((S.commission_due_stage || 'purchase_contract') as any);   // earned from this phase on

  const deals = dealsR.data || [];
  const holding = new Map<string, any>();
  for (const d of deals) if ((PHASES as readonly string[]).includes(d.stage)) holding.set(d.unit_id, d);
  const spacePrice = Object.fromEntries((spacesR.data || []).map(s => [s.id, s.price]));
  const parkingInDeals = new Set<string>();

  type Row = { phase: Phase; value: number; list: number; units: number; parking: number; rate: number };
  const rows: Row[] = [];
  for (const u of unitsR.data || []) {
    const d = holding.get(u.id);
    if (d) {
      const park = (d.deal_parking || []) as { parking_id: string; price: number | null }[];
      park.forEach(p => parkingInDeals.add(p.parking_id));
      const parkValue = park.reduce((a, p) => a + Number(p.price ?? spacePrice[p.parking_id] ?? 0), 0);
      const parkList = park.reduce((a, p) => a + Number(spacePrice[p.parking_id] ?? 0), 0);
      rows.push({ phase: d.stage, value: Number(d.price ?? u.price) + parkValue, list: Number(u.price) + parkList, units: 1, parking: park.length, rate: Number(d.commission_rate ?? std) });
    } else if (u.status === 'sold' || u.status === 'reserved') {     // set by hand, without a deal
      rows.push({ phase: u.status, value: Number(u.price), list: Number(u.price), units: 1, parking: 0, rate: std });
    } else if (u.status !== 'unavailable') {
      rows.push({ phase: 'free', value: Number(u.price), list: Number(u.price), units: 1, parking: 0, rate: std });
    }
  }
  let unpricedParking = 0;
  for (const s of spacesR.data || []) {
    if (parkingInDeals.has(s.id) || s.status === 'unavailable' || !s.is_public) continue;
    if (s.price == null) { unpricedParking++; continue; }
    const phase: Phase = s.status === 'sold' ? 'sold' : s.status === 'reserved' ? 'reserved' : 'free';
    rows.push({ phase, value: Number(s.price), list: Number(s.price), units: 0, parking: 1, rate: std });
  }

  const sum = (ph: Phase[], f: (r: Row) => number) => rows.filter(r => ph.includes(r.phase)).reduce((a, r) => a + f(r), 0);
  const steps = ([...PHASES, 'free'] as Phase[]).map(ph => ({
    phase: ph, value: sum([ph], r => r.value), units: sum([ph], r => r.units), parking: sum([ph], r => r.parking),
    discount: sum([ph], r => r.list - r.value),
  }));
  const total = steps.reduce((a, s) => a + s.value, 0);

  const earnedPh = PHASES.slice(0, dueIdx + 1) as Phase[];
  const pipelinePh = PHASES.slice(dueIdx + 1) as Phase[];
  const commission = {
    rate: std, rate_complex: Number(S.commission_rate_complex ?? 0.015), claims_rate: claimsRate,
    base: S.commission_base === 'net' ? 'net' : 'gross', due_stage: PHASES[dueIdx],
    earned: sum(earnedPh, r => base(r.value) * r.rate),
    pipeline: sum(pipelinePh, r => base(r.value) * r.rate),
    potential: sum(['free'], r => base(r.value) * r.rate),
    claims: sum([...PHASES, 'free'], r => base(r.value) * claimsRate),
  };
  const offers = deals.filter(d => d.stage === 'interest' || d.stage === 'offer');

  const out: Record<string, unknown> = {
    steps, total, commission, unpriced_parking: unpricedParking,
    offers: { count: offers.length, units: new Set(offers.map(d => d.unit_id)).size },
    discount_total: steps.reduce((a, s) => a + s.discount, 0),
  };

  if (isAdmin) {
    const net = (g: number) => g / (1 + vat);
    const commissionAll = commission.earned + commission.pipeline + commission.potential;
    const marketing = Number(S.marketing_monthly ?? 0) * Number(S.marketing_months ?? 0);
    const costs = S.costs_total == null ? null : Number(S.costs_total);
    const revenueNet = net(total);
    const profit = costs == null ? null : revenueNet - costs - commissionAll - commission.claims - marketing;
    const contracted = steps.filter(s => s.phase === 'sold' || s.phase === 'purchase_contract').reduce((a, s) => a + s.value, 0);
    const secured = steps.filter(s => s.phase !== 'free').reduce((a, s) => a + s.value, 0);
    out.profit = {
      vat_rate: vat, revenue_gross: total, revenue_net: revenueNet, vat: total - revenueNet,
      commission: commissionAll, claims: commission.claims, marketing, costs, profit,
      margin: profit == null || !revenueNet ? null : profit / revenueNet,
      contracted_net: net(contracted), secured_net: net(secured),
      // what the free stock still has to bring in for the costs (break-even), with VAT
      break_even_gross: costs == null ? null : Math.max(0, (costs + commissionAll + commission.claims + marketing) * (1 + vat) - secured),
    };
  }
  out.settings = (setR.data || []).filter(s => isAdmin || !s.admin_only);
  return NextResponse.json(out);
}

// Admin only: { key: value, ... } for crm_settings
export async function PATCH(req: NextRequest) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const body = await req.json();
  const sb = getSupabaseAdmin();
  const { data: cur } = await sb.from('crm_settings').select('key, value');
  const known = Object.fromEntries((cur || []).map(s => [s.key, s.value]));
  const log = [];
  for (const [k, v] of Object.entries(body)) {
    if (!(k in known)) return NextResponse.json({ error: `Neznáme nastavenie ${k}` }, { status: 400 });
    await sb.from('crm_settings').update({ value: v, updated_by: user.username, updated_at: new Date().toISOString() }).eq('key', k);
    log.push({ entity: 'setting', entity_id: k, action: 'update', field: k, old_value: JSON.stringify(known[k]), new_value: JSON.stringify(v) });
  }
  await logActivity(user, log);
  return NextResponse.json({ ok: true });
}
