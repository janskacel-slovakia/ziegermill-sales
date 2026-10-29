import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import { loadReview, notify, syncKeyOk, cleanPhotos, STATUSES, REVIEW_BUCKET } from '@/app/lib/review';

// The Studio's side of the review (flats\_architect\review_sync.py), with the key REVIEW_SYNC_KEY (Authorization: Bearer).
// The Studio is the master of the points (title, text, position, view, still); the website of the architect's replies.
// Statuses: the later change wins. Studio thread entries come in once each (studio_key).
//   GET  -> the whole review, deleted points and messages too, with message ids
//   POST { points: [...], deleted: [id], messages: [{point_id, by, text, at, studio_key, photos}], status: [{id, status, at}],
//          sheets: {panel, pages}, quiet } -> { ok, inserted: {studio_key: id}, review }
export async function GET(req: NextRequest) {
  if (!syncKeyOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await loadReview({ withDeleted: true }));
}

const iso = (v: unknown) => { const d = new Date(String(v || '')); return isNaN(+d) ? null : d.toISOString(); };

export async function POST(req: NextRequest) {
  if (!syncKeyOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json();
  const sb = getSupabaseAdmin(); const now = new Date().toISOString();
  const { data: had } = await sb.from('review_points').select('id, status_at, deleted_at');
  const known = new Map((had || []).map(p => [p.id, p]));
  const news: { n: number; title: string; text: string }[] = [];

  const rows = (Array.isArray(b.points) ? b.points : []).filter((p: any) => /^[A-Za-z0-9_-]{1,40}$/.test(p?.id || '')).map((p: any) => ({
    id: p.id, n: Number(p.n) || 0, date: p.date || null, unit: p.unit ?? null, page: Number(p.page) || null, plan: String(p.plan || ''),
    at: p.at, title: String(p.title || ''), text: String(p.text || ''), source: p.source ?? null, view: p.view ?? null,
    ...(p.still_path !== undefined ? { still_path: p.still_path, still_pin: p.still_pin ?? null } : {}),
    ...(p.important !== undefined ? { important: !!p.important } : {}),
    studio_at: iso(p.studio_at) || now, deleted_at: null, updated_at: now,
  }));
  if (rows.length) {
    const { error } = await sb.from('review_points').upsert(rows, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of rows) if (!known.has(r.id) || known.get(r.id)!.deleted_at) news.push({ n: r.n, title: r.title, text: r.text });
  }
  const del = (Array.isArray(b.deleted) ? b.deleted : []).filter((id: unknown) => typeof id === 'string');
  if (del.length) await sb.from('review_points').update({ deleted_at: now, updated_at: now }).in('id', del).is('deleted_at', null);

  for (const s of Array.isArray(b.status) ? b.status : []) {
    const at = iso(s.at); const k = known.get(s.id);
    if (!at || !STATUSES.includes(s.status) || (k && k.status_at && k.status_at >= at)) continue;
    await sb.from('review_points').update({ status: s.status, status_at: at, status_by: 'studio', updated_at: now }).eq('id', s.id).lt('status_at', at);
  }

  const inserted: Record<string, string> = {};
  const answered = new Map<string, { n: number; title: string; text: string }>();
  for (const m of Array.isArray(b.messages) ? b.messages : []) {
    if (!m?.studio_key || !m.point_id || !['user', 'claude', 'architect'].includes(m.by)) continue;
    const { data: ex } = await sb.from('review_messages').select('id').eq('studio_key', m.studio_key).maybeSingle();
    if (ex) { inserted[m.studio_key] = ex.id; continue; }
    const { data: ins, error } = await sb.from('review_messages').insert({
      point_id: m.point_id, by: m.by, author: 'studio', text: String(m.text || '').slice(0, 8000), photos: cleanPhotos(m.photos, m.point_id),
      origin: 'studio', studio_key: String(m.studio_key).slice(0, 80), created_at: iso(m.at) || now,
    }).select('id').single();
    if (error) continue;
    inserted[m.studio_key] = ins.id;
    if (m.by === 'user') {
      const p = rows.find((r: any) => r.id === m.point_id) || (await sb.from('review_points').select('n, title').eq('id', m.point_id).single()).data;
      if (p) answered.set(m.point_id, { n: p.n, title: p.title, text: String(m.text || '') });
    }
  }

  if (b.sheets && Array.isArray(b.sheets.pages)) {
    const body = JSON.stringify({ panel: b.sheets.panel ?? 360, pages: b.sheets.pages.map((p: any) => ({
      page: p.page, plan: p.plan, name: p.name, w: p.w, h: p.h, map: p.map, png: p.png, px: p.px })) });
    await sb.storage.from(REVIEW_BUCKET).upload('sheets/pages.json', new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
  }
  if (!b.quiet) await notify('architect', [...news, ...answered.values()], req.nextUrl.origin);
  return NextResponse.json({ ok: true, inserted, review: await loadReview({ withDeleted: true }) });
}
