import { NextResponse } from 'next/server';
import { getReviewer } from '@/app/lib/admin-auth';

export async function GET() {
  const user = await getReviewer();
  if (!user) return NextResponse.json({ error: 'Neprihlásený' }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, display_name: user.display_name, role: user.role } });
}
