import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';

// The architect's personal link is /review#k=<token>. The fragment never reaches a server or its request log; the page
// posts it here once, gets a session (cookie review_token, as long as the link is valid) and drops it from the address.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  const bad = () => NextResponse.json({ error: 'Odkaz je neplatný alebo mu skončila platnosť. Požiadajte o nový.' }, { status: 401 });
  if (typeof token !== 'string' || !/^[0-9a-f]{96}$/.test(token)) return bad();
  const sb = getSupabaseAdmin(); const now = new Date();
  const { data: l } = await sb.from('review_links').select('user_id, expires_at, admin_users(role, is_active)')
    .eq('token', token).is('revoked_at', null).gt('expires_at', now.toISOString()).single();
  const u = (l as any)?.admin_users;
  if (!l || !u || u.is_active === false || u.role !== 'architect') return bad();

  const session = crypto.randomBytes(48).toString('hex');
  await sb.from('admin_sessions').delete().eq('user_id', l.user_id).lt('expires_at', now.toISOString());
  await sb.from('admin_sessions').insert({ token: session, user_id: l.user_id, expires_at: l.expires_at });
  await sb.from('review_links').update({ last_used_at: now.toISOString() }).eq('token', token);
  await sb.from('admin_users').update({ last_login: now.toISOString() }).eq('id', l.user_id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('review_token', session, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    maxAge: Math.max(60, Math.floor((new Date(l.expires_at).getTime() - now.getTime()) / 1000)),
  });
  return res;
}
