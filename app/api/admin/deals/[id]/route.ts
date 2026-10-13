import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff, STORAGE_BUCKET } from '@/app/lib/admin-auth';
import { STAGES, Stage, syncHoldings } from '@/app/lib/crm';
import { saveDealLinks, stageDates, checkParkingFree, commissionCheck, DEAL_SELECT } from '../shared';

const AGENT_FIELDS = ['stage', 'reserved_at', 'reserved_until', 'future_contract_at', 'purchase_contract_at', 'notes', 'commission_rate'];
const ADMIN_FIELDS = [...AGENT_FIELDS, 'price', 'list_price', 'reservation_fee', 'agent_id'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const [deal, docs, log] = await Promise.all([
    sb.from('deals').select(DEAL_SELECT).eq('id', id).single(),
    sb.from('deal_documents').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
    sb.from('activity_log').select('*').eq('entity', 'deal').eq('entity_id', id).order('at', { ascending: false }).limit(100),
  ]);
  if (deal.error) return NextResponse.json({ error: deal.error.message }, { status: 404 });
  return NextResponse.json({ ...deal.data, documents: docs.data || [], activity: log.data || [] });
}

// Admin only: delete a deal made by mistake (with its files). A real deal that ended is 'cancelled' instead.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data: deal } = await sb.from('deals').select('*, deal_parking(parking_id), deal_documents(storage_path)').eq('id', id).single();
  if (!deal) return NextResponse.json({ error: 'Obchod neexistuje' }, { status: 404 });
  const files = deal.deal_documents.map((d: any) => d.storage_path);
  if (files.length) await sb.storage.from(STORAGE_BUCKET).remove(files);
  const { error } = await sb.from('deals').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const synced = await syncHoldings([deal.unit_id], deal.deal_parking.map((p: any) => p.parking_id));
  await logActivity(user, [{ entity: 'deal', entity_id: id, action: 'delete', old_value: `${deal.unit_id} – ${deal.stage}` }, ...synced]);
  return NextResponse.json({ ok: true });
}

// Any of the fields above, plus customer_ids: [uuid] and parking: [{ id, price? }] to replace those lists.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const { customer_ids, parking: parkingIn, note, ...rest } = await req.json();
  const { ok: updates, refused } = allowFields(rest, user.role === 'admin' ? ADMIN_FIELDS : AGENT_FIELDS);
  if (refused.length) return NextResponse.json({ error: `Nemáte oprávnenie meniť: ${refused.join(', ')}` }, { status: 403 });
  if (updates.stage && !STAGES.includes(updates.stage as Stage)) return NextResponse.json({ error: 'Neznámy stav' }, { status: 400 });
  for (const k of Object.keys(updates)) if (updates[k] === '') updates[k] = null;

  const sb = getSupabaseAdmin();
  if ('commission_rate' in updates) {   // one of the agreed options (standard = null) - the agent picks it per deal
    const bad = await commissionCheck(updates.commission_rate);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }
  const { data: before } = await sb.from('deals').select('*, deal_parking(parking_id, price), deal_customers(customer_id)').eq('id', id).single();
  if (!before) return NextResponse.json({ error: 'Obchod neexistuje' }, { status: 404 });

  const stage = (updates.stage ?? before.stage) as Stage;
  const parking = Array.isArray(parkingIn)
    ? parkingIn.map((p: any) => {
        if (user.role === 'admin') return { id: p.id, price: p.price };
        const had = before.deal_parking.find((x: any) => x.parking_id === p.id);   // agent keeps the agreed price
        return { id: p.id, price: had ? had.price : undefined };
      })
    : undefined;
  const parkingIds = parking ? parking.map(p => p.id) : before.deal_parking.map((p: any) => p.parking_id);
  const busy = await checkParkingFree(parkingIds, stage, id);
  if (busy) return NextResponse.json({ error: busy }, { status: 409 });

  if (updates.stage && updates.stage !== before.stage) Object.assign(updates, { ...stageDates(stage, { ...before, ...updates }), ...updates });
  if (Object.keys(updates).length) {
    const { error } = await sb.from('deals').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'Jednotku už drží iný obchod (rezervácia alebo zmluva)' : error.message }, { status: 409 });
  }
  await saveDealLinks(id, customer_ids, parking);

  const oldParking = before.deal_parking.map((p: any) => p.parking_id);
  const synced = await syncHoldings([before.unit_id], [...new Set([...oldParking, ...parkingIds])]);
  const log = [...diff('deal', id, before, updates).map(a => (a.field === 'stage' && note ? { ...a, action: 'stage', note } : a)), ...synced];
  if (parking) {
    const was = oldParking.sort().join(', '), now = parkingIds.slice().sort().join(', ');
    if (was !== now) log.push({ entity: 'deal', entity_id: id, action: 'update', field: 'parking', old_value: was, new_value: now });
  }
  if (Array.isArray(customer_ids)) {
    const was = before.deal_customers.map((c: any) => c.customer_id).sort().join(','), now = customer_ids.slice().sort().join(',');
    if (was !== now) log.push({ entity: 'deal', entity_id: id, action: 'update', field: 'customers', old_value: String(before.deal_customers.length), new_value: String(customer_ids.length) });
  }
  if (note && !updates.stage) log.push({ entity: 'deal', entity_id: id, action: 'note', note });
  await logActivity(user, log);

  const { data } = await sb.from('deals').select(DEAL_SELECT).eq('id', id).single();
  return NextResponse.json(data);
}
