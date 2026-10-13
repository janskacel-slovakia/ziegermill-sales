import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser, allowFields, logActivity } from '@/app/lib/admin-auth';
import { CUSTOMER_FIELDS } from '@/app/lib/crm';

// Clients with their deals; ?q= searches name, company, email, phone.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const q = req.nextUrl.searchParams.get('q')?.trim();
  let query = getSupabaseAdmin().from('customers')
    .select('*, deal_customers(role, deals(id, unit_id, stage))')
    .order('created_at', { ascending: false });
  if (q) {
    const s = `%${q.replace(/[%,()]/g, ' ')}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},company_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { ok } = allowFields(await req.json(), CUSTOMER_FIELDS);
  const blank = (v: unknown) => v == null || String(v).trim() === '';
  if (blank(ok.last_name) && blank(ok.company_name) && blank(ok.email))
    return NextResponse.json({ error: 'Zadajte aspoň priezvisko, firmu alebo email' }, { status: 400 });
  for (const k of Object.keys(ok)) if (ok[k] === '') ok[k] = null;

  const { data, error } = await getSupabaseAdmin().from('customers').insert({ ...ok, created_by: user.username }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(user, { entity: 'customer', entity_id: data.id, action: 'create', new_value: [data.first_name, data.last_name, data.company_name].filter(Boolean).join(' ') });
  return NextResponse.json(data);
}
