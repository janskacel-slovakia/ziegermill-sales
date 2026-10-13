import { getSupabaseAdmin } from '@/app/lib/admin-auth';
import { HOLDING, Stage } from '@/app/lib/crm';

export const DEAL_SELECT = `*, units(id, name, floor_number, rooms, price, status, total_area),
  deal_customers(role, position, customers(id, kind, title, first_name, last_name, company_name, email, phone)),
  deal_parking(price, parking_spaces(id, label, kind, price, status)),
  agent:admin_users!deals_agent_id_fkey(id, display_name)`;

// Dates that follow the stage, filled once (the agent can correct them).
export function stageDates(stage: Stage, current: Record<string, any>) {
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<string, unknown> = {};
  if (stage === 'reserved' && !current.reserved_at) out.reserved_at = today;
  if (stage === 'reserved' && !current.reserved_until)
    out.reserved_until = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);   // RZ: ZBKZ within 30 days
  if (stage === 'future_contract' && !current.future_contract_at) out.future_contract_at = today;
  if (stage === 'purchase_contract' && !current.purchase_contract_at) out.purchase_contract_at = today;
  out.closed_at = stage === 'sold' || stage === 'cancelled' ? (current.closed_at ?? new Date().toISOString()) : null;
  return out;
}

// A parking space can be in many offers but held by only one deal. Returns an error message or null.
export async function checkParkingFree(ids: string[], stage: Stage, dealId: string | null) {
  if (!ids.length || !HOLDING.includes(stage)) return null;
  const { data } = await getSupabaseAdmin().from('deal_parking')
    .select('parking_id, deals!inner(id, unit_id, stage)').in('parking_id', ids).in('deals.stage', HOLDING);
  const taken = (data || []).filter((r: any) => r.deals.id !== dealId);
  return taken.length ? `Státie ${taken.map((r: any) => `${r.parking_id} (k ${r.deals.unit_id})`).join(', ')} už drží iný obchod` : null;
}

// Replace the deal's clients and parking spaces (when given).
export async function saveDealLinks(dealId: string, customerIds?: string[], parking?: { id: string; price?: number | null }[]) {
  const sb = getSupabaseAdmin();
  if (Array.isArray(customerIds)) {
    await sb.from('deal_customers').delete().eq('deal_id', dealId);
    if (customerIds.length)
      await sb.from('deal_customers').insert(customerIds.map((c, i) => ({ deal_id: dealId, customer_id: c, role: 'buyer', position: i + 1 })));
  }
  if (Array.isArray(parking)) {
    const { data: spaces } = await sb.from('parking_spaces').select('id, price').in('id', parking.map(p => p.id));
    const listPrice = Object.fromEntries((spaces || []).map(s => [s.id, s.price]));
    await sb.from('deal_parking').delete().eq('deal_id', dealId);
    if (parking.length)
      await sb.from('deal_parking').insert(parking.map(p => ({ deal_id: dealId, parking_id: p.id, price: p.price ?? listPrice[p.id] ?? null })));
  }
}

// The commission options from the agent's offer (crm_settings): null = standard rate, or the complicated-case rate.
export async function commissionCheck(rate: unknown) {
  if (rate == null) return null;
  const { data } = await getSupabaseAdmin().from('crm_settings').select('key, value').in('key', ['commission_rate', 'commission_rate_complex']);
  const allowed = (data || []).map(s => Number(s.value));
  return allowed.includes(Number(rate)) ? null : 'Neplatná sadzba provízie';
}
