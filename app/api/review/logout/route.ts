import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('review_token')?.value;
  if (token) await getSupabaseAdmin().from('admin_sessions').delete().eq('token', token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('review_token');
  return res;
}
