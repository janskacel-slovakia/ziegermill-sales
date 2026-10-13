import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff } from '@/app/lib/admin-auth';
import { sendMail, siteUrl } from '@/app/lib/mail';

// { display_name, role, email, phone, is_active, password }. The admin may change anyone; everybody may change their
// own name, email, phone and password. A password change logs the user out everywhere.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = Number((await params).id);
  const self = id === user.id;
  if (!self && user.role !== 'admin') return NextResponse.json({ error: 'Len pre administrátora' }, { status: 403 });

  const { password, ...rest } = await req.json();
  const { ok, refused } = allowFields(rest, user.role === 'admin' ? ['display_name', 'role', 'email', 'phone', 'is_active'] : ['display_name', 'email', 'phone']);
  if (refused.length) return NextResponse.json({ error: `Nemáte oprávnenie meniť: ${refused.join(', ')}` }, { status: 403 });
  if (self && (ok.role === 'agent' || ok.is_active === false)) return NextResponse.json({ error: 'Sám sebe rolu ani prístup nevezmete' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: before } = await sb.from('admin_users').select('id, username, display_name, role, email, phone, is_active, approved_at').eq('id', id).single();
  if (!before) return NextResponse.json({ error: 'Používateľ neexistuje' }, { status: 404 });
  const approving = ok.is_active === true && !before.approved_at;
  if (Object.keys(ok).length) {
    const { error } = await sb.from('admin_users').update(approving ? { ...ok, approved_at: new Date().toISOString(), approved_by: user.username } : ok).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const log = diff('user', String(id), before, ok);
  if (approving) {
    log.push({ entity: 'user', entity_id: String(id), action: 'approve', new_value: `${before.username} (${ok.role || before.role})` } as any);
    const to = before.email || (before.username.includes('@') ? before.username : null);
    if (to) await sendMail({
      to, subject: 'Ziegermill admin: prístup schválený',
      text: `Dobrý deň ${before.display_name || ''},

váš prístup do administrácie predaja Ziegermill bol schválený. Prihlásite sa svojím emailom a heslom na ${siteUrl(req.nextUrl.origin)}/admin`,
    }).catch(() => {});
  }
  if (password) {
    if (String(password).length < 10) return NextResponse.json({ error: 'Heslo musí mať aspoň 10 znakov' }, { status: 400 });
    const { error } = await sb.rpc('change_admin_password', { p_user_id: id, p_new_password: password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await sb.from('admin_sessions').delete().eq('user_id', id);
    log.push({ entity: 'user', entity_id: String(id), action: 'password', note: self ? 'vlastné heslo' : 'nastavené administrátorom' } as any);
  }
  if (ok.is_active === false) await sb.from('admin_sessions').delete().eq('user_id', id);
  await logActivity(user, log);
  return NextResponse.json({ ok: true, relogin: !!password && self });
}

// Admin only: remove a user (not yourself). Their name stays in the history as text.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const id = Number((await params).id);
  if (id === user.id) return NextResponse.json({ error: 'Sám seba nezmažete' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data: u } = await sb.from('admin_users').select('username, role').eq('id', id).single();
  if (!u) return NextResponse.json({ error: 'Používateľ neexistuje' }, { status: 404 });
  await sb.from('deals').update({ agent_id: null }).eq('agent_id', id);
  const { error } = await sb.from('admin_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'user', entity_id: String(id), action: 'delete', old_value: `${u.username} (${u.role})` });
  return NextResponse.json({ ok: true });
}
