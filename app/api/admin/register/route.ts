import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import { sendMail, siteUrl } from '@/app/lib/mail';

// Registration on the login page: { email, display_name, phone, password, website (honeypot) }.
// Creates an inactive agent account; it can log in only after the admin approves it in Používatelia.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.website) return NextResponse.json({ ok: true });              // bots fill the hidden field
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.display_name || '').trim();
  if (!/^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(email) || !name) return NextResponse.json({ error: 'Zadajte meno a platný email' }, { status: 400 });
  if (String(b.password || '').length < 10) return NextResponse.json({ error: 'Heslo musí mať aspoň 10 znakov' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { count } = await sb.from('admin_users').select('id', { count: 'exact', head: true }).is('approved_at', null).not('requested_at', 'is', null);
  if ((count || 0) >= 20) return NextResponse.json({ error: 'Príliš veľa čakajúcich registrácií, kontaktujte administrátora' }, { status: 429 });
  const { data: exists } = await sb.from('admin_users').select('id').or(`username.eq.${email},email.eq.${email}`).limit(1);
  if (exists?.length) return NextResponse.json({ error: 'Účet s týmto emailom už existuje. Ak ste zabudli heslo, použite „Zabudnuté heslo“.' }, { status: 409 });

  const { data: id, error } = await sb.rpc('create_admin_user', { p_username: email, p_password: b.password, p_display_name: name, p_role: 'agent' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from('admin_users').update({ is_active: false, email, phone: b.phone || null, requested_at: new Date().toISOString() }).eq('id', id);
  await sb.from('activity_log').insert({ entity: 'user', entity_id: String(id), action: 'register', new_value: `${email} (${name})`, actor: email });

  // let the admins know (if email is set up)
  const { data: admins } = await sb.from('admin_users').select('email, username').eq('role', 'admin').eq('is_active', true);
  for (const a of admins || []) {
    const to = a.email || (a.username.includes('@') ? a.username : null);
    if (to) await sendMail({
      to, subject: `Ziegermill admin: nová registrácia – ${name}`,
      text: `${name} (${email}${b.phone ? `, ${b.phone}` : ''}) sa zaregistroval(a) do administrácie predaja.\n\nSchváliť alebo zamietnuť: ${siteUrl(req.nextUrl.origin)}/admin (Používatelia)`,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
