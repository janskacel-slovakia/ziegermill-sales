import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, logActivity } from '@/app/lib/admin-auth';
import { STAGES, Stage, syncHoldings } from '@/app/lib/crm';
import { saveDealLinks, stageDates, checkParkingFree, commissionCheck, DEAL_SELECT } from './shared';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { data, error } = await getSupabaseAdmin().from('deals').select(DEAL_SELECT).order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// { unit_id, customer_ids: [uuid], parking: [{ id, price? }], stage?, reserved_until?, notes?, price? (admin) }
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json();
  const sb = getSupabaseAdmin();

  const { data: unit } = await sb.from('units').select('id, price').eq('id', body.unit_id).single();
  if (!unit) return NextResponse.json({ error: 'Vyberte jednotku' }, { status: 400 });
  const stage: Stage = STAGES.includes(body.stage) ? body.stage : 'offer';
  const parking: { id: string; price?: number }[] = (Array.isArray(body.parking) ? body.parking : [])
    .map((p: any) => (user.role === 'admin' ? { id: p.id, price: p.price } : { id: p.id }));   // agent: list prices
  const badRate = await commissionCheck(body.commission_rate);
  if (badRate) return NextResponse.json({ error: badRate }, { status: 400 });
  const busy = await checkParkingFree(parking.map(p => p.id), stage, null);
  if (busy) return NextResponse.json({ error: busy }, { status: 409 });

  const row: Record<string, unknown> = {
    unit_id: unit.id, stage, agent_id: user.role === 'agent' ? user.id : (body.agent_id ?? null),
    list_price: unit.price, price: user.role === 'admin' && body.price != null ? body.price : unit.price,
    reservation_fee: user.role === 'admin' && body.reservation_fee != null ? body.reservation_fee : 5000,
    reserved_until: body.reserved_until || null, notes: body.notes || null, created_by: user.username,
    commission_rate: body.commission_rate ?? null,
    ...stageDates(stage, {}),
  };
  const { data: deal, error } = await sb.from('deals').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Jednotku už drží iný obchod (rezervácia alebo zmluva)' : error.message }, { status: 409 });

  await saveDealLinks(deal.id, body.customer_ids, parking);
  const synced = await syncHoldings([unit.id], parking.map(p => p.id));
  await logActivity(user, [{ entity: 'deal', entity_id: deal.id, action: 'create', new_value: `${unit.id} – ${stage}` }, ...synced]);
  return NextResponse.json(deal);
}
