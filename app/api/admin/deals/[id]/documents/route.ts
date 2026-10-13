import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, logActivity, storageName, STORAGE_BUCKET } from '@/app/lib/admin-auth';

const SOURCES = ['template', 'generated', 'custom', 'signed', 'customer'];

// Two ways to add a document to a deal:
//   { from_templates: 'current' }          copy every current template into the deal (the generic first draft)
//   { from_template: <id> }                copy one template version
//   { storage_path, file_name, kind, title, source, ... }   register a file uploaded via /api/admin/files
//     (the client-specific version edited in Word, the signed scan, a document from the client ...)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const b = await req.json();
  const sb = getSupabaseAdmin();
  const { data: deal } = await sb.from('deals').select('id, unit_id').eq('id', id).single();
  if (!deal) return NextResponse.json({ error: 'Obchod neexistuje' }, { status: 404 });

  if (b.from_templates || b.from_template) {
    let q = sb.from('doc_templates').select('*');
    q = b.from_template ? q.eq('id', b.from_template) : q.eq('is_current', true);
    const { data: templates } = await q.order('kind');
    if (!templates?.length) return NextResponse.json({ error: 'Žiadne šablóny na skopírovanie' }, { status: 400 });
    const rows = [];
    for (const t of templates) {
      const path = `deals/${id}/${storageName(`${deal.unit_id}_${t.file_name}`)}`;
      const { error } = await sb.storage.from(STORAGE_BUCKET).copy(t.storage_path, path);
      if (error) return NextResponse.json({ error: `${t.title}: ${error.message}` }, { status: 500 });
      rows.push({ deal_id: id, kind: t.kind, title: t.title, source: 'template', template_id: t.id, storage_path: path,
        file_name: `${deal.unit_id}_${t.file_name}`, mime: t.mime, size: t.size,
        notes: t.version ? `šablóna ${t.version}` : null, uploaded_by: user.username });
    }
    const { data, error } = await sb.from('deal_documents').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logActivity(user, { entity: 'deal', entity_id: id, action: 'document', new_value: rows.map(r => r.title).join(', '), note: 'zo šablón' });
    return NextResponse.json(data);
  }

  if (!b.storage_path?.startsWith(`deals/${id}/`) || !b.title?.trim()) return NextResponse.json({ error: 'Chýba súbor alebo názov' }, { status: 400 });
  const { data, error } = await sb.from('deal_documents').insert({
    deal_id: id, kind: b.kind || 'other', title: b.title.trim(), source: SOURCES.includes(b.source) ? b.source : 'custom',
    template_id: b.template_id || null, storage_path: b.storage_path, file_name: b.file_name, mime: b.mime || null,
    size: b.size || null, notes: b.notes || null, uploaded_by: user.username,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'deal', entity_id: id, action: 'document', new_value: data.title, note: data.file_name });
  return NextResponse.json(data);
}

// ?doc=<id>: the person who added it, or the admin. Removes the file too.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const docId = req.nextUrl.searchParams.get('doc');
  const sb = getSupabaseAdmin();
  const { data: doc } = await sb.from('deal_documents').select('*').eq('id', docId).eq('deal_id', id).single();
  if (!doc) return NextResponse.json({ error: 'Dokument neexistuje' }, { status: 404 });
  if (user.role !== 'admin' && doc.uploaded_by !== user.username)
    return NextResponse.json({ error: 'Zmazať môže len ten, kto ho pridal, alebo administrátor' }, { status: 403 });
  await sb.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
  await sb.from('deal_documents').delete().eq('id', doc.id);
  await logActivity(user, { entity: 'deal', entity_id: id, action: 'document_delete', old_value: doc.title, note: doc.file_name });
  return NextResponse.json({ ok: true });
}
