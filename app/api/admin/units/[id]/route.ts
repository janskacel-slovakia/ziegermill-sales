import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff } from '@/app/lib/admin-auth';

const ADMIN_FIELDS = ['name', 'rooms', 'rooms_count', 'layout', 'view_type', 'orientation', 'interior_area', 'exterior_area',
  'exterior_type', 'gallery_area', 'total_area', 'area_with_podium', 'price', 'status', 'is_public', 'description',
  'floor_plan_pdf_url', 'walkthrough_url', 'sort_order', 'price_list'];
const AGENT_FIELDS = ['status'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const { ok: updates, refused } = allowFields(await req.json(), user.role === 'admin' ? ADMIN_FIELDS : AGENT_FIELDS);
  if (refused.length) return NextResponse.json({ error: `Nemáte oprávnenie meniť: ${refused.join(', ')}` }, { status: 403 });
  const sb = getSupabaseAdmin();

  const { data: current } = await sb.from('units').select('*').eq('id', id).single();
  if (!current) return NextResponse.json({ error: 'Jednotka neexistuje' }, { status: 404 });

  // Manual audit for fields the trigger (price, status, interior_area, exterior_area) does not cover
  const trigger = ['price', 'status', 'interior_area', 'exterior_area'];
  for (const [field, value] of Object.entries(updates)) {
    if (!trigger.includes(field) && String(value ?? '') !== String(current[field] ?? '')) {
      await sb.from('unit_changes').insert({
        unit_id: id, field_name: field, old_value: current[field]?.toString() ?? null,
        new_value: value?.toString() ?? null, changed_by: user.username,
      });
    }
  }

  const { data, error } = await sb.from('units').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The trigger doesn't know the user
  await sb.from('unit_changes')
    .update({ changed_by: user.username })
    .eq('unit_id', id)
    .is('changed_by', null)
    .gte('changed_at', new Date(Date.now() - 5000).toISOString());
  await logActivity(user, diff('unit', id, current, updates));

  return NextResponse.json(data);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const [unitRes, historyRes] = await Promise.all([
    sb.from('units').select('*').eq('id', id).single(),
    sb.from('unit_changes').select('*').eq('unit_id', id).order('changed_at', { ascending: false }).limit(50),
  ]);

  if (unitRes.error) return NextResponse.json({ error: unitRes.error.message }, { status: 500 });

  return NextResponse.json({ unit: unitRes.data, history: historyRes.data || [] });
}
