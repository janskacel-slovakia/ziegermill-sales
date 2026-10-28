import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin, requireUser, logActivity } from '@/app/lib/admin-auth';
import { siteUrl } from '@/app/lib/mail';

// The architect's personal link to /review (19 Oct 2026, Jano: "there shouldn't be complicated login for him"): one long
// secret token, valid 90 days, no password. Admin only. GET shows the current link (to copy), POST issues a new one (the
// old one stops working), DELETE revokes it and ends his sessions. The token is never logged.
const DAYS = 90;

async function target(id: number) {
  const { data } = await getSupabaseAdmin().from('admin_users').select('id, username, role, is_active').eq('id', id).single();
  return data;
}

function shape(origin: string, l: any) {
  return l ? { url: `${siteUrl(origin)}/review#k=${l.token}`, expires_at: l.expires_at, created_at: l.created_at, last_used_at: l.last_used_at } : null;
}

async function current(id: number) {
  const { data } = await getSupabaseAdmin().from('review_links').select('token, expires_at, created_at, last_used_at')
    .eq('user_id', id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const id = Number((await params).id);
  return NextResponse.json({ link: shape(req.nextUrl.origin, await current(id)) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const id = Number((await params).id);
  const u = await target(id);
  if (!u) return NextResponse.json({ error: 'Používateľ neexistuje' }, { status: 404 });
  if (u.role !== 'architect') return NextResponse.json({ error: 'Osobný odkaz je len pre rolu architekt' }, { status: 400 });
  const sb = getSupabaseAdmin(); const now = new Date();
  await sb.from('review_links').update({ revoked_at: now.toISOString() }).eq('user_id', id).is('revoked_at', null);
  await sb.from('admin_sessions').delete().eq('user_id', id);          // the old link's sessions end with it
  const token = crypto.randomBytes(48).toString('hex');
  const { data, error } = await sb.from('review_links').insert({
    token, user_id: id, expires_at: new Date(now.getTime() + DAYS * 86400e3).toISOString(), created_by: user.username,
  }).select('token, expires_at, created_at, last_used_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!u.is_active) await sb.from('admin_users').update({ is_active: true }).eq('id', id);
  await logActivity(user, { entity: 'user', entity_id: String(id), action: 'review_link', note: `nový osobný odkaz do ${data.expires_at.slice(0, 10)}` });
  return NextResponse.json({ link: shape(req.nextUrl.origin, data) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const id = Number((await params).id);
  const sb = getSupabaseAdmin();
  await sb.from('review_links').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).is('revoked_at', null);
  await sb.from('admin_sessions').delete().eq('user_id', id);
  await logActivity(user, { entity: 'user', entity_id: String(id), action: 'review_link', note: 'osobný odkaz zrušený' });
  return NextResponse.json({ ok: true });
}
