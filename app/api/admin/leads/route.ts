import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/app/lib/admin-auth';

// Contacts left on the website, with the client made from each (if any).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const sb = getSupabaseAdmin();
  const [leads, linked] = await Promise.all([
    sb.from('leads').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('customers').select('id, lead_id').not('lead_id', 'is', null),
  ]);
  if (leads.error) return NextResponse.json({ error: leads.error.message }, { status: 500 });
  const byLead = Object.fromEntries((linked.data || []).map(c => [c.lead_id, c.id]));
  return NextResponse.json((leads.data || []).map(l => ({ ...l, customer_id: byLead[l.id] || null })));
}
