import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, logActivity } from '@/app/lib/admin-auth';

const TEMPLATE_KINDS = ['RZ', 'ZBKZ', 'KZ', 'standard', 'annex', 'other'];

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { data, error } = await getSupabaseAdmin().from('doc_templates').select('*')
    .order('kind').order('title').order('uploaded_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Register an uploaded file (see /api/admin/files) as a new version of a template. The newest version of the same
// kind + title becomes the current one, the older ones stay as history.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const b = await req.json();
  if (!TEMPLATE_KINDS.includes(b.kind) || !b.title?.trim() || !b.storage_path?.startsWith(`templates/${b.kind}/`))
    return NextResponse.json({ error: 'Chýba druh, názov alebo súbor' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const title = b.title.trim();
  await sb.from('doc_templates').update({ is_current: false }).eq('kind', b.kind).eq('title', title);
  const { data, error } = await sb.from('doc_templates').insert({
    kind: b.kind, title, version: b.version || null, notes: b.notes || null, storage_path: b.storage_path,
    file_name: b.file_name, mime: b.mime || null, size: b.size || null, is_current: true, uploaded_by: user.username,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'template', entity_id: data.id, action: 'upload', new_value: `${b.kind}: ${title} ${b.version || ''}`.trim(), note: b.file_name });
  return NextResponse.json(data);
}
