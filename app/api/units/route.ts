import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 13 Oct 2026: the 3D selector on 3d.ziegermill.sk (Cloudflare R2) reads the prices from here - a public, read-only list
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60, s-maxage=60',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json(data, { headers: CORS });
}