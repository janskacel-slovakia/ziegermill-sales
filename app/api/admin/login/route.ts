import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = body.password;
    const remember = body.remember === true;   // "Zapamätať si ma": 30 days, else until the browser closes (max 12 h)
    if (!username || !password) {
      return NextResponse.json({ error: 'Zadajte meno a heslo' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Verify credentials via pgcrypto
    const { data, error } = await sb.rpc('verify_admin_login', {
      p_username: username,
      p_password: password,
    });

    if (error || !data || data.length === 0) {
      const { data: pending } = await sb.from('admin_users').select('id').eq('username', username)
        .eq('is_active', false).is('approved_at', null).not('requested_at', 'is', null).limit(1);
      if (pending?.length) return NextResponse.json({ error: 'Registrácia ešte čaká na schválenie administrátorom.' }, { status: 403 });
      return NextResponse.json({ error: 'Nesprávne prihlasovacie údaje' }, { status: 401 });
    }

    const user = data[0];
    if (user.role === 'architect')     // the architect has only /review, through his personal link
      return NextResponse.json({ error: 'Tento účet sa prihlasuje osobným odkazom na pripomienky (/review).' }, { status: 403 });

    // Create session token
    const token = crypto.randomBytes(48).toString('hex');
    const maxAge = remember ? 30 * 86400 : 12 * 3600;
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();

    await sb.from('admin_sessions').insert({ token, user_id: user.id, expires_at: expiresAt });
    await sb.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const response = NextResponse.json({ user });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      ...(remember ? { maxAge } : {}),   // without maxAge the cookie ends with the browser session
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}