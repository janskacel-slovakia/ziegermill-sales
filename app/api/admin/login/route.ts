import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
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
      return NextResponse.json({ error: 'Nesprávne prihlasovacie údaje' }, { status: 401 });
    }

    const user = data[0];

    // Create session token
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await sb.from('admin_sessions').insert({ token, user_id: user.id, expires_at: expiresAt });
    await sb.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const response = NextResponse.json({ user });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}