import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getAdminUser } from '@/app/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const updates = await req.json();
  const sb = getSupabaseAdmin();

  // Log who made the change (the trigger logs what changed automatically)
  // But we also want to log the username — insert manual entries for fields the trigger doesn't cover
  const manualFields = ['name', 'rooms', 'orientation', 'exterior_type', 'floor_plan_pdf_url', 'description'];

  // Get current values for manual audit
  const { data: current } = await sb.from('units').select('*').eq('id', id).single();
  if (!current) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  // Manual audit for fields not covered by trigger
  for (const field of manualFields) {
    if (updates[field] !== undefined && updates[field] !== current[field]) {
      await sb.from('unit_changes').insert({
        unit_id: id,
        field_name: field,
        old_value: current[field]?.toString() || null,
        new_value: updates[field]?.toString() || null,
        changed_by: user.username,
      });
    }
  }

  // For trigger-tracked fields (price, status, interior_area, exterior_area),
  // update the changed_by after the trigger fires
  const { data, error } = await sb.from('units').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update changed_by on auto-logged entries (trigger doesn't know the user)
  await sb.from('unit_changes')
    .update({ changed_by: user.username })
    .eq('unit_id', id)
    .is('changed_by', null)
    .gte('changed_at', new Date(Date.now() - 5000).toISOString()); // Last 5 seconds

  return NextResponse.json(data);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const [unitRes, historyRes] = await Promise.all([
    sb.from('units').select('*').eq('id', id).single(),
    sb.from('unit_changes').select('*').eq('unit_id', id).order('changed_at', { ascending: false }).limit(50),
  ]);

  if (unitRes.error) return NextResponse.json({ error: unitRes.error.message }, { status: 500 });

  return NextResponse.json({ unit: unitRes.data, history: historyRes.data || [] });
}