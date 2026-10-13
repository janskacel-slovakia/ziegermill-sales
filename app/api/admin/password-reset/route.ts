import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import { sendMail, siteUrl, mailConfigured } from '@/app/lib/mail';

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const GENERIC = 'Ak účet s týmto emailom existuje, poslali sme naň odkaz na nové heslo (platí 1 hodinu).';

// Step 1, { email }: email a one-time link /admin/reset?token=... The answer is the same whether the account exists
// or not. At most 3 links per account per hour.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || '').trim().toLowerCase();
  if (!e || /[,()\s]/.test(e)) return NextResponse.json({ error: 'Zadajte email' }, { status: 400 });
  if (process.env.NODE_ENV === 'production' && !mailConfigured())
    return NextResponse.json({ error: 'Obnova hesla emailom zatiaľ nie je zapnutá. Nové heslo vám nastaví administrátor.' }, { status: 503 });

  const sb = getSupabaseAdmin();
  const { data: users } = await sb.from('admin_users').select('id, username, email, display_name, is_active')
    .or(`username.eq.${e},email.eq.${e}`).eq('is_active', true).limit(1);
  const u = users?.[0];
  if (u) {
    const { count } = await sb.from('password_resets').select('token_hash', { count: 'exact', head: true })
      .eq('user_id', u.id).gt('created_at', new Date(Date.now() - 3600e3).toISOString());
    if ((count || 0) < 3) {
      const token = crypto.randomBytes(32).toString('base64url');
      await sb.from('password_resets').insert({ token_hash: hash(token), user_id: u.id, expires_at: new Date(Date.now() + 3600e3).toISOString() });
      const link = `${siteUrl(req.nextUrl.origin)}/admin/reset?token=${token}`;
      await sendMail({
        to: u.email || u.username,
        subject: 'Ziegermill admin: nové heslo',
        text: `Dobrý deň ${u.display_name || ''},\n\nnové heslo do administrácie predaja Ziegermill si nastavíte tu (odkaz platí 1 hodinu a dá sa použiť raz):\n${link}\n\nAk ste o zmenu hesla nežiadali, tento email ignorujte.`,
      }).catch(err => console.error('password reset mail failed', err));
    }
  }
  return NextResponse.json({ ok: true, message: GENERIC });
}

// Step 2, { token, password }: set the new password, end all sessions of that user.
export async function PUT(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: 'Chýba odkaz' }, { status: 400 });
  if (String(password || '').length < 10) return NextResponse.json({ error: 'Heslo musí mať aspoň 10 znakov' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data: r } = await sb.from('password_resets').select('*').eq('token_hash', hash(String(token))).single();
  if (!r || r.used_at || new Date(r.expires_at) < new Date())
    return NextResponse.json({ error: 'Odkaz je neplatný alebo vypršal. Vyžiadajte si nový.' }, { status: 400 });
  const { error } = await sb.rpc('change_admin_password', { p_user_id: r.user_id, p_new_password: password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from('password_resets').update({ used_at: new Date().toISOString() }).eq('user_id', r.user_id).is('used_at', null);
  await sb.from('admin_sessions').delete().eq('user_id', r.user_id);
  await sb.from('activity_log').insert({ entity: 'user', entity_id: String(r.user_id), action: 'password', note: 'cez odkaz z emailu', actor: 'reset' });
  return NextResponse.json({ ok: true });
}
