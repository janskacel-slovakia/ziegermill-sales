import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff } from '@/app/lib/admin-auth';

// Several spaces at once (e.g. one price for all garage spaces): { ids: [...], price: 25000 }. Admin only.
export async function PATCH(req: NextRequest) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;

  const { ids, ...rest } = await req.json();
  const { ok: updates, refused } = allowFields(rest, ['price', 'status', 'is_public']);
  if (refused.length || !Array.isArray(ids) || !ids.length) return NextResponse.json({ error: 'Neplatná požiadavka' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: before } = await sb.from('parking_spaces').select('*').in('id', ids);
  const { error } = await sb.from('parking_spaces').update(updates).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, (before || []).flatMap(b => diff('parking', b.id, b, updates)));
  return NextResponse.json({ ok: true, count: ids.length });
}

// All parking spaces with the deals they are offered in / held by.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const sb = getSupabaseAdmin();
  const [spaces, links] = await Promise.all([
    sb.from('parking_spaces').select('*').order('sort_order'),
    sb.from('deal_parking').select('parking_id, price, deals(id, unit_id, stage)'),
  ]);
  if (spaces.error) return NextResponse.json({ error: spaces.error.message }, { status: 500 });

  const byId: Record<string, any[]> = {};
  for (const l of links.data || []) {
    const d: any = l.deals;
    if (d && d.stage !== 'cancelled') (byId[l.parking_id] ||= []).push({ ...d, price: l.price });
  }
  return NextResponse.json((spaces.data || []).map(s => ({ ...s, deals: byId[s.id] || [] })));
}
