import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireReviewer, logActivity } from '@/app/lib/admin-auth';
import { STATUSES, ARCHITECT_STATUSES, Status } from '@/app/lib/review';

// { status }: the architect may answer or agree; Jano anything (agreed, done, or open again).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireReviewer();
  if (user instanceof NextResponse) return user;
  const id = (await params).id;
  const { status } = await req.json();
  if (!STATUSES.includes(status) || (user.role === 'architect' && !ARCHITECT_STATUSES.includes(status as Status)))
    return NextResponse.json({ error: 'Tento stav nemôžete nastaviť' }, { status: 403 });
  const sb = getSupabaseAdmin();
  const { data: before } = await sb.from('review_points').select('status').eq('id', id).is('deleted_at', null).single();
  if (!before) return NextResponse.json({ error: 'Pripomienka neexistuje' }, { status: 404 });
  const { error } = await sb.from('review_points').update({ status, status_at: new Date().toISOString(), status_by: user.username, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'review', entity_id: id, action: 'status', field: 'status', old_value: before.status, new_value: status });
  return NextResponse.json({ ok: true });
}
