import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/admin-auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token) {
    const sb = getSupabaseAdmin();
    await sb.from('admin_sessions').delete().eq('token', token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_token', '', { maxAge: 0, path: '/' });
  return response;
}