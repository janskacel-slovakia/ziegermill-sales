import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/app/lib/admin-auth';

// ?entity=unit|parking|deal|customer|template|user&id=... (both optional) -> the newest 200 entries
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const entity = req.nextUrl.searchParams.get('entity');
  const id = req.nextUrl.searchParams.get('id');
  let q = getSupabaseAdmin().from('activity_log').select('*').order('at', { ascending: false }).limit(200);
  if (entity) q = q.eq('entity', entity);
  if (id) q = q.eq('entity_id', id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
