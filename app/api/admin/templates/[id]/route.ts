import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity, diff, STORAGE_BUCKET } from '@/app/lib/admin-auth';

// { is_current, title, version, notes }. Making one current makes the others of the same kind + title not current.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const { ok, refused } = allowFields(await req.json(), ['is_current', 'title', 'version', 'notes']);
  if (refused.length) return NextResponse.json({ error: 'Neplatná požiadavka' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: before } = await sb.from('doc_templates').select('*').eq('id', id).single();
  if (!before) return NextResponse.json({ error: 'Šablóna neexistuje' }, { status: 404 });
  if (ok.is_current === true)
    await sb.from('doc_templates').update({ is_current: false }).eq('kind', before.kind).eq('title', ok.title ?? before.title);
  const { data, error } = await sb.from('doc_templates').update(ok).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, diff('template', id, before, ok));
  return NextResponse.json(data);
}

// Admin only: removes the version and its file. Deals that used it keep their own copies.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('admin');
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data: t } = await sb.from('doc_templates').select('*').eq('id', id).single();
  if (!t) return NextResponse.json({ error: 'Šablóna neexistuje' }, { status: 404 });
  await sb.storage.from(STORAGE_BUCKET).remove([t.storage_path]);
  await sb.from('doc_templates').delete().eq('id', id);
  await logActivity(user, { entity: 'template', entity_id: id, action: 'delete', old_value: `${t.kind}: ${t.title} ${t.version || ''}`.trim(), note: t.file_name });
  return NextResponse.json({ ok: true });
}
