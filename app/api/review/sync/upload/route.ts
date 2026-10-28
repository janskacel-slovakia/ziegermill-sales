import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import { syncKeyOk, REVIEW_BUCKET } from '@/app/lib/review';

// The Studio's uploads (stills, sheets, photos pasted in the Studio): POST { path } -> { path, token, url } for a one-time
// signed upload (replacing a file of the same name); with the key REVIEW_SYNC_KEY.
export async function POST(req: NextRequest) {
  if (!syncKeyOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { path } = await req.json();
  if (!/^(stills|sheets|photos\/[A-Za-z0-9_-]+)\/[A-Za-z0-9._-]{1,120}$/.test(path || '')) return NextResponse.json({ error: 'bad path' }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().storage.from(REVIEW_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token, url: data.signedUrl });
}
