import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireReviewer, logActivity } from '@/app/lib/admin-auth';
import { cleanPhotos, notify, STATUSES, ARCHITECT_STATUSES, Status } from '@/app/lib/review';

// A reply: { text, photos: [{path, name, w, h}] (uploaded first through /api/review/files), status? }.
// The architect's reply makes the point "answered" (or "agreed" if he picks it); Jano's makes it "open" again for the
// architect unless he picks another status.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireReviewer();
  if (user instanceof NextResponse) return user;
  const id = (await params).id;
  const b = await req.json();
  const text = String(b.text || '').replace(/\r\n/g, '\n').trim().slice(0, 8000);
  const photos = cleanPhotos(b.photos, id);
  if (!text && !photos.length) return NextResponse.json({ error: 'Prázdna odpoveď' }, { status: 400 });
  const arch = user.role === 'architect';
  let status: Status = arch ? 'answered' : 'open';
  if (b.status) {
    if (!STATUSES.includes(b.status) || (arch && !ARCHITECT_STATUSES.includes(b.status))) return NextResponse.json({ error: 'Tento stav nemôžete nastaviť' }, { status: 403 });
    status = b.status;
  }
  const sb = getSupabaseAdmin();
  const { data: p } = await sb.from('review_points').select('id, n, title, status').eq('id', id).is('deleted_at', null).single();
  if (!p) return NextResponse.json({ error: 'Pripomienka neexistuje' }, { status: 404 });
  const now = new Date().toISOString();
  const { data: m, error } = await sb.from('review_messages').insert({ point_id: id, by: arch ? 'architect' : 'user', author: user.username, text, photos, origin: 'web' })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from('review_points').update({ status, status_at: now, status_by: user.username, updated_at: now }).eq('id', id);
  await logActivity(user, [{ entity: 'review', entity_id: id, action: 'reply', note: `${text.slice(0, 200)}${photos.length ? ` (+${photos.length} foto)` : ''}` },
    ...(p.status !== status ? [{ entity: 'review', entity_id: id, action: 'status', field: 'status', old_value: p.status, new_value: status }] : [])]);
  await notify(arch ? 'jano' : 'architect', [{ n: p.n, title: p.title, text }], req.nextUrl.origin, user);
  return NextResponse.json({ ok: true, id: m.id, status });
}
