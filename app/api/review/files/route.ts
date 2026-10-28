import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireReviewer } from '@/app/lib/admin-auth';
import { REVIEW_BUCKET, photoPath } from '@/app/lib/review';

// A photo for a reply: POST { point_id, file_name } -> { path, token }; the browser uploads straight to the private
// bucket with the one-time signed URL (no 4.5 MB request limit), then sends the path with the reply.
export async function POST(req: NextRequest) {
  const user = await requireReviewer();
  if (user instanceof NextResponse) return user;
  const { point_id, file_name } = await req.json();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(point_id || '') || !file_name || !/\.(jpe?g|png|webp|gif|heic|pdf)$/i.test(file_name))
    return NextResponse.json({ error: 'Len obrázky (jpg, png, webp, heic) alebo PDF' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data: p } = await sb.from('review_points').select('id').eq('id', point_id).is('deleted_at', null).single();
  if (!p) return NextResponse.json({ error: 'Pripomienka neexistuje' }, { status: 404 });
  const { data, error } = await sb.storage.from(REVIEW_BUCKET).createSignedUploadUrl(photoPath(point_id, file_name));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
