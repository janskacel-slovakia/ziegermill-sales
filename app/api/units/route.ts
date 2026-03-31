import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data, error } = await supabase
    .from('units')
    .select('id, name, unit_type, floor_number, rooms, interior_area, exterior_area, exterior_type, orientation, price, price_per_m2, status')
    .in('status', ['available', 'reserved', 'sold'])
    .order('floor_number', { ascending: false })
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}