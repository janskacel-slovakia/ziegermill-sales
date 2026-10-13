import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, storageName, STORAGE_BUCKET } from '@/app/lib/admin-auth';

// Files live in the private bucket 'crm': templates/<kind>/<file>, deals/<deal id>/<file>. The browser uploads
// straight to storage with a one-time signed URL (so big PDFs don't pass through Vercel's 4.5 MB request limit),
// then registers the file with /api/admin/templates or /api/admin/deals/<id>/documents.

// POST { folder: 'templates/RZ' | 'deals/<uuid>', file_name } -> { path, token }
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { folder, file_name } = await req.json();
  if (!/^(templates\/[A-Za-z]+|deals\/[0-9a-f-]{36})$/.test(folder || '') || !file_name)
    return NextResponse.json({ error: 'Neplatné umiestnenie' }, { status: 400 });

  const path = `${folder}/${storageName(file_name)}`;
  const { data, error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}

// GET ?path=...&name=... -> redirect to a 5-minute download link
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const path = req.nextUrl.searchParams.get('path') || '';
  const name = req.nextUrl.searchParams.get('name') || undefined;
  if (!/^(templates|deals)\//.test(path) || path.includes('..')) return NextResponse.json({ error: 'Neplatná cesta' }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).createSignedUrl(path, 300, { download: name ?? true });
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
