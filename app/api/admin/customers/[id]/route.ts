import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff } from '@/app/lib/admin-auth';
import { CUSTOMER_FIELDS } from '@/app/lib/crm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const [c, log] = await Promise.all([
    sb.from('customers').select('*, deal_customers(role, deals(id, unit_id, stage, price, created_at))').eq('id', id).single(),
    sb.from('activity_log').select('*').eq('entity', 'customer').eq('entity_id', id).order('at', { ascending: false }).limit(50),
  ]);
  if (c.error) return NextResponse.json({ error: c.error.message }, { status: 404 });
  return NextResponse.json({ ...c.data, activity: log.data || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const { ok, refused } = allowFields(await req.json(), CUSTOMER_FIELDS);
  if (refused.length) return NextResponse.json({ error: `Neznáme polia: ${refused.join(', ')}` }, { status: 400 });
  for (const k of Object.keys(ok)) if (ok[k] === '') ok[k] = null;

  const sb = getSupabaseAdmin();
  const { data: before } = await sb.from('customers').select('*').eq('id', id).single();
  if (!before) return NextResponse.json({ error: 'Klient neexistuje' }, { status: 404 });
  const { data, error } = await sb.from('customers').update(ok).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // personal numbers are logged as changed, never with their value
  await logActivity(user, diff('customer', id, before, ok).map(a =>
    ['birth_number', 'iban'].includes(a.field!) ? { ...a, old_value: a.old_value ? '•••' : null, new_value: a.new_value ? '•••' : null } : a));
  return NextResponse.json(data);
}

// Admin only: delete a client who is in no deal (e.g. a duplicate).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data: c } = await sb.from('customers').select('*, deal_customers(deal_id)').eq('id', id).single();
  if (!c) return NextResponse.json({ error: 'Klient neexistuje' }, { status: 404 });
  if (c.deal_customers.length) return NextResponse.json({ error: 'Klient je v obchode – najprv ho z obchodu odoberte' }, { status: 409 });
  const { error } = await sb.from('customers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'customer', entity_id: id, action: 'delete', old_value: [c.first_name, c.last_name, c.company_name].filter(Boolean).join(' ') });
  return NextResponse.json({ ok: true });
}
