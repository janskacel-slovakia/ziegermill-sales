import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin, requireUser, logActivity } from '@/app/lib/admin-auth';

const COLS = 'id, username, display_name, role, email, phone, is_active, last_login, created_at, requested_at, approved_at, approved_by';

// Admin only: list the admin's users.
export async function GET() {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const { data, error } = await getSupabaseAdmin().from('admin_users').select(COLS).order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Admin only: { username, password, display_name, role, email, phone }. An architect gets no password he would use: he
// signs in with his personal link (/api/admin/users/<id>/link), so a random one is set.
export async function POST(req: NextRequest) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const b = await req.json();
  if (b.role === 'architect' && !b.password) b.password = crypto.randomBytes(24).toString('base64url');
  if (!b.username?.trim() || !b.password || b.password.length < 10 || !['admin', 'agent', 'architect'].includes(b.role))
    return NextResponse.json({ error: 'Meno, rola a heslo (aspoň 10 znakov) sú povinné' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data: newId, error } = await sb.rpc('create_admin_user', {
    p_username: b.username.trim(), p_password: b.password, p_display_name: b.display_name || b.username, p_role: b.role,
  });
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Používateľ už existuje' : error.message }, { status: 409 });
  await sb.from('admin_users').update({ email: b.email || null, phone: b.phone || null, approved_at: new Date().toISOString(), approved_by: user.username }).eq('id', newId);
  await logActivity(user, { entity: 'user', entity_id: String(newId), action: 'create', new_value: `${b.username} (${b.role})` });
  const { data } = await sb.from('admin_users').select(COLS).eq('id', newId).single();
  return NextResponse.json(data);
}
