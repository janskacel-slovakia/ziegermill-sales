import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getAdminUser } from '@/app/lib/admin-auth';

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('units')
    .select('*')
    .order('floor_number', { ascending: false })
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}