import { NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/app/lib/admin-auth';

// All units with the deal that holds each one (reserved or further), for the admin's list.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const sb = getSupabaseAdmin();
  const [units, deals] = await Promise.all([
    sb.from('units').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('id'),
    sb.from('deals').select('id, unit_id, stage, deal_customers(customers(first_name, last_name, company_name))')
      .neq('stage', 'cancelled'),
  ]);
  if (units.error) return NextResponse.json({ error: units.error.message }, { status: 500 });

  const byUnit: Record<string, any[]> = {};
  for (const d of deals.data || []) (byUnit[d.unit_id] ||= []).push(d);
  return NextResponse.json((units.data || []).map(u => ({ ...u, deals: byUnit[u.id] || [] })));
}
