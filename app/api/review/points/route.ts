import { NextResponse } from 'next/server';
import { requireReviewer } from '@/app/lib/admin-auth';
import { loadReview } from '@/app/lib/review';

// The review for the page: sheets, points, threads, signed picture links. Jano (admin) or the architect.
export async function GET() {
  const user = await requireReviewer();
  if (user instanceof NextResponse) return user;
  try {
    const r = await loadReview();
    return NextResponse.json({ ...r, me: { id: user.id, display_name: user.display_name, role: user.role } });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
