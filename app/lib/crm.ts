import { getSupabaseAdmin } from './admin-auth';

export const CUSTOMER_FIELDS = ['kind', 'title', 'first_name', 'last_name', 'birth_surname', 'birth_date', 'birth_number',
  'nationality', 'address', 'correspondence_address', 'email', 'phone', 'iban', 'company_name', 'ico', 'dic', 'ic_dph',
  'registry', 'statutory', 'lead_id', 'source', 'notes'];

// Deal stages in order. A deal from 'reserved' on holds its unit and parking (status reserved, then sold).
export const STAGES = ['interest', 'offer', 'reserved', 'future_contract', 'purchase_contract', 'sold', 'cancelled'] as const;
export type Stage = typeof STAGES[number];
export const HOLDING: Stage[] = ['reserved', 'future_contract', 'purchase_contract', 'sold'];

// What the unit's / parking space's status should be while a deal at this stage holds it. A signed KZ is a sale
// (Jano, 9 Oct); 'sold' is the last stage, "Odovzdané" (registered in the land register and handed over).
export function holdStatus(stage: Stage) {
  return stage === 'purchase_contract' || stage === 'sold' ? 'sold' : HOLDING.includes(stage) ? 'reserved' : null;
}

// Bring the unit's and the parking spaces' status in line with the deals that hold them. Only touches what a deal
// decides: a space no holding deal has any more goes back to 'available' only if it was 'reserved'/'sold' by a deal
// (a status set by hand, e.g. 'unavailable', stays). Returns the changes made, for the log.
export async function syncHoldings(unitIds: string[], parkingIds: string[]) {
  const sb = getSupabaseAdmin();
  const changes: { entity: string; entity_id: string; action: string; field: string; old_value: string; new_value: string; note: string }[] = [];

  const { data: deals } = await sb.from('deals').select('id, unit_id, stage, deal_parking(parking_id)').in('stage', HOLDING);
  const unitHold: Record<string, Stage> = {}, parkHold: Record<string, Stage> = {};
  for (const d of deals || []) {
    unitHold[d.unit_id] = d.stage;
    for (const p of (d as any).deal_parking || []) parkHold[p.parking_id] = d.stage;
  }

  const apply = async (table: 'units' | 'parking_spaces', entity: string, ids: string[], hold: Record<string, Stage>) => {
    if (!ids.length) return;
    const { data: rows } = await sb.from(table).select('id, status').in('id', ids);
    for (const r of rows || []) {
      const want = hold[r.id] ? holdStatus(hold[r.id]) : (['reserved', 'sold'].includes(r.status) ? 'available' : r.status);
      if (want && want !== r.status) {
        await sb.from(table).update({ status: want }).eq('id', r.id);
        changes.push({ entity, entity_id: r.id, action: 'update', field: 'status', old_value: r.status, new_value: want, note: 'podľa obchodu' });
      }
    }
  };
  await apply('units', 'unit', unitIds, unitHold);
  await apply('parking_spaces', 'parking', parkingIds, parkHold);
  return changes;
}
