import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Roles (admin_users.role): 'admin' = Jano, everything; 'agent' = the real estate agent: status, reservations,
// clients, deals, documents and templates, but not prices, areas, website settings or users; 'architect' (19 Oct) =
// only the architect review (/review, /api/review): never /api/admin. Its session comes from a personal link and sits in
// its own cookie, review_token; requireUser() refuses the role anyway.
export type Role = 'admin' | 'agent' | 'architect';
export type AdminUser = { id: number; username: string; display_name: string; role: Role; email: string | null; phone: string | null };

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getAdminUser(cookie: 'admin_token' | 'review_token' = 'admin_token'): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookie)?.value;
  if (!token) return null;

  const sb = getSupabaseAdmin();

  // Clean expired sessions
  await sb.from('admin_sessions').delete().lt('expires_at', new Date().toISOString());

  const { data: session } = await sb
    .from('admin_sessions')
    .select('user_id, admin_users(id, username, display_name, role, email, phone, is_active)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  const u = (session as any)?.admin_users;
  if (!u || u.is_active === false) return null;
  delete u.is_active;
  return u;
}

// For route handlers: `const auth = await requireUser(); if (auth instanceof NextResponse) return auth;`
// The sales admin: admin and agent only.
export async function requireUser(role?: 'admin'): Promise<AdminUser | NextResponse> {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Neprihlásený' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'agent') return NextResponse.json({ error: 'Bez prístupu' }, { status: 403 });
  if (role === 'admin' && user.role !== 'admin') return NextResponse.json({ error: 'Len pre administrátora' }, { status: 403 });
  return user;
}

// The architect review: Jano (his admin login) or the architect (the personal link's session). An agent has no access.
export async function getReviewer(): Promise<AdminUser | null> {
  const admin = await getAdminUser('admin_token');
  if (admin?.role === 'admin') return admin;
  const arch = await getAdminUser('review_token');
  return arch && (arch.role === 'architect' || arch.role === 'admin') ? arch : null;
}

export async function requireReviewer(): Promise<AdminUser | NextResponse> {
  const user = await getReviewer();
  return user ?? NextResponse.json({ error: 'Neprihlásený' }, { status: 401 });
}

// Keep only the fields this role may change. Returns the allowed subset and the names that were refused.
export function allowFields(updates: Record<string, unknown>, allowed: string[]) {
  const ok: Record<string, unknown> = {};
  const refused: string[] = [];
  for (const [k, v] of Object.entries(updates)) (allowed.includes(k) ? (ok[k] = v) : refused.push(k));
  return { ok, refused };
}

type Activity = { entity: string; entity_id: string; action: string; field?: string; old_value?: unknown; new_value?: unknown; note?: string };

export async function logActivity(user: AdminUser, items: Activity | Activity[]) {
  const rows = (Array.isArray(items) ? items : [items]).map(a => ({
    ...a,
    old_value: a.old_value == null ? null : String(a.old_value),
    new_value: a.new_value == null ? null : String(a.new_value),
    actor: user.username,
  }));
  if (rows.length) await getSupabaseAdmin().from('activity_log').insert(rows);
}

// One activity row per changed field.
export function diff(entity: string, id: string, before: Record<string, any>, after: Record<string, unknown>): Activity[] {
  return Object.entries(after)
    .filter(([k, v]) => String(before[k] ?? '') !== String(v ?? ''))
    .map(([k, v]) => ({ entity, entity_id: id, action: 'update', field: k, old_value: before[k], new_value: v }));
}

export const STORAGE_BUCKET = 'crm';

// A safe storage key from a file name (keeps the extension, drops diacritics and odd characters).
export function storageName(fileName: string) {
  const clean = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${Date.now()}_${clean}`.slice(0, 160);
}
