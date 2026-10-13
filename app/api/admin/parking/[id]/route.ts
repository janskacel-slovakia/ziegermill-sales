import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff } from '@/app/lib/admin-auth';

const ADMIN_FIELDS = ['label', 'price', 'status', 'is_public', 'accessible', 'notes', 'sort_order'];
const AGENT_FIELDS = ['status', 'notes'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const { ok: updates, refused } = allowFields(await req.json(), user.role === 'admin' ? ADMIN_FIELDS : AGENT_FIELDS);
  if (refused.length) return NextResponse.json({ error: `Nemáte oprávnenie meniť: ${refused.join(', ')}` }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data: current } = await sb.from('parking_spaces').select('*').eq('id', id).single();
  if (!current) return NextResponse.json({ error: 'Státie neexistuje' }, { status: 404 });

  const { data, error } = await sb.from('parking_spaces').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, diff('parking', id, current, updates));
  return NextResponse.json(data);
}
