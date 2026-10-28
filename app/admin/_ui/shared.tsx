'use client';

import React from 'react';
import { createClient } from '@supabase/supabase-js';

export type Role = 'admin' | 'agent' | 'architect';
export type User = { id: number; username: string; display_name: string; role: Role; email: string | null; phone: string | null };

export type Unit = {
  id: string; name: string; unit_type: string; layout: string | null; floor_number: number; rooms: string; rooms_count: number | null;
  view_type: string | null; interior_area: number; gallery_area: number | null; exterior_area: number; exterior_type: string | null;
  total_area: number | null; area_with_podium: number | null; orientation: string; price: number; price_per_m2: number;
  status: string; is_public: boolean; description: string | null; walkthrough_url: string | null; sort_order: number | null;
  price_list: string | null; updated_at: string; deals: DealRef[];
};
export type DealRef = { id: string; unit_id: string; stage: Stage; deal_customers?: { customers: Customer }[] };
export type Parking = {
  id: string; kind: 'garage' | 'outdoor'; number: number; label: string; plan: string; shape: number[][] | null; accessible: boolean;
  price: number | null; status: string; is_public: boolean; notes: string | null; deals: { id: string; unit_id: string; stage: Stage; price: number | null }[];
};
export type Customer = {
  id: string; kind: 'person' | 'company'; title: string | null; first_name: string | null; last_name: string | null;
  birth_surname?: string | null; birth_date?: string | null; birth_number?: string | null; nationality?: string | null;
  address?: string | null; correspondence_address?: string | null; email: string | null; phone: string | null; iban?: string | null;
  company_name: string | null; ico?: string | null; dic?: string | null; ic_dph?: string | null; registry?: string | null;
  statutory?: string | null; lead_id?: number | null; source?: string | null; notes?: string | null; created_at?: string;
  deal_customers?: { role: string; deals: { id: string; unit_id: string; stage: Stage } }[];
};
export type Stage = 'interest' | 'offer' | 'reserved' | 'future_contract' | 'purchase_contract' | 'sold' | 'cancelled';
export type Deal = {
  id: string; unit_id: string; stage: Stage; agent_id: number | null; list_price: number | null; price: number | null;
  reservation_fee: number | null; commission_rate: number | null; reserved_at: string | null; reserved_until: string | null; future_contract_at: string | null;
  purchase_contract_at: string | null; notes: string | null; created_by: string; created_at: string; updated_at: string;
  units: Pick<Unit, 'id' | 'name' | 'floor_number' | 'rooms' | 'price' | 'status' | 'total_area'>;
  deal_customers: { role: string; position: number; customers: Customer }[];
  deal_parking: { price: number | null; parking_spaces: Pick<Parking, 'id' | 'label' | 'kind' | 'price' | 'status'> }[];
  agent: { id: number; display_name: string } | null;
  documents?: Doc[]; activity?: Activity[];
};
export type Doc = {
  id: string; kind: string; title: string; source: string; template_id: string | null; storage_path: string; file_name: string;
  mime: string | null; size: number | null; notes: string | null; uploaded_by: string; created_at: string;
};
export type Template = {
  id: string; kind: string; title: string; version: string | null; storage_path: string; file_name: string; mime: string | null;
  size: number | null; is_current: boolean; notes: string | null; uploaded_by: string; uploaded_at: string;
};
export type Activity = { id: number; entity: string; entity_id: string; action: string; field: string | null; old_value: string | null; new_value: string | null; note: string | null; actor: string; at: string };

export const ST_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'Voľný', color: '#16a34a', bg: '#f0fdf4' },
  reserved: { label: 'Rezervovaný', color: '#ca8a04', bg: '#fefce8' },
  sold: { label: 'Predaný', color: '#dc2626', bg: '#fef2f2' },
  unavailable: { label: 'Nedostupný', color: '#6b7280', bg: '#f3f4f6' },
};
export const STAGE_LABELS: Record<Stage, { label: string; color: string }> = {
  interest: { label: 'Záujem', color: '#64748b' },
  offer: { label: 'Ponuka', color: '#6b9fb3' },
  reserved: { label: 'Rezervácia (RZ)', color: '#e8901a' },
  future_contract: { label: 'Zmluva o budúcej (ZOBZ)', color: '#3091b2' },
  purchase_contract: { label: 'Kúpna zmluva (KZ) – predané', color: '#04318c' },
  sold: { label: 'Odovzdané', color: '#544740' },
  cancelled: { label: 'Zrušené', color: '#9ca3af' },
};
export const STAGE_ORDER: Stage[] = ['interest', 'offer', 'reserved', 'future_contract', 'purchase_contract', 'sold', 'cancelled'];
export const KIND_LABELS: Record<string, string> = {
  RZ: 'Rezervačná zmluva (RZ)', ZBKZ: 'Zmluva o budúcej kúpnej zmluve (ZOBZ)', KZ: 'Kúpna zmluva (KZ)',
  standard: 'Štandard', annex: 'Príloha', other: 'Iné',
};
export const SOURCE_LABELS: Record<string, string> = {
  template: 'všeobecný návrh', generated: 'vygenerované', custom: 'upravené pre klienta', signed: 'podpísané', customer: 'od klienta',
};
export const FIELD_LABELS: Record<string, string> = {
  price: 'cena', status: 'stav', stage: 'fáza', interior_area: 'interiér', exterior_area: 'exteriér', total_area: 'spolu',
  gallery_area: 'galéria', is_public: 'na webe', notes: 'poznámka', reserved_until: 'rezervácia do', reserved_at: 'rezervované',
  parking: 'parkovanie', customers: 'klienti', name: 'názov', label: 'názov', email: 'email', phone: 'telefón', role: 'rola',
  is_current: 'platná', reservation_fee: 'rezervačný poplatok', list_price: 'cenníková cena', closed_at: 'uzavreté',
  future_contract_at: 'ZOBZ dňa', purchase_contract_at: 'KZ dňa', walkthrough_url: '3D prehliadka', description: 'popis',
};

export const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('sk-SK').format(n));
export const eur = (n: number | null | undefined) => (n == null ? '—' : `${fmt(Math.round(n))} €`);
export const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('sk-SK') : '—');
export const dateTime = (s: string) => new Date(s).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const customerName = (c?: Partial<Customer> | null) =>
  !c ? '' : c.kind === 'company' && c.company_name ? c.company_name : [c.title, c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '(bez mena)';

// fetch JSON from the admin API; throws the server's Slovak message on error
export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Chyba ${r.status}`);
  return d;
}

// Upload a file straight into the private store (signed one-time URL from the server), returns its path.
export async function uploadFile(folder: string, file: File) {
  const { path, token } = await api<{ path: string; token: string }>('/api/admin/files', 'POST', { folder, file_name: file.name });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error } = await sb.storage.from('crm').uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Nahrávanie zlyhalo: ${error.message}`);
  return { storage_path: path, file_name: file.name, mime: file.type || null, size: file.size };
}
export const downloadUrl = (path: string, name?: string) => `/api/admin/files?path=${encodeURIComponent(path)}${name ? `&name=${encodeURIComponent(name)}` : ''}`;

// ─── small UI pieces ───
export function StatusBadge({ status }: { status: string }) {
  const st = ST_LABELS[status] || ST_LABELS.unavailable;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
    </span>
  );
}
export function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGE_LABELS[stage];
  return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap" style={{ background: s.color }}>{s.label}</span>;
}
export function Card({ title, actions, children }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-zm-neutral overflow-hidden">
      {(title || actions) && (
        <div className="px-4 sm:px-6 py-3 border-b border-zm-line flex flex-wrap gap-2 justify-between items-center">
          <h2 className="font-bold text-zm-ink">{title}</h2>
          <div className="flex flex-wrap gap-2 items-center">{actions}</div>
        </div>
      )}
      {children}
    </div>
  );
}
// Small spinning ring for "working..." states.
export function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <span aria-label="Pracujem" className={`inline-block align-[-2px] rounded-full border-2 border-current border-r-transparent animate-spin ${className}`} />;
}

// The Ziegermill logo (neutral plate, black lettering) - works on the brand's dark, blue and orange backgrounds.
export function Logo({ className = 'h-9' }: { className?: string }) {
  return <img src="/logo.svg" alt="Ziegermill" className={`${className} w-auto`} />;
}

// The identity's bar motif (the mill's crenellations), as a thin band.
export function Bars({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`h-2 ${className}`} style={{ backgroundImage: 'repeating-linear-gradient(90deg, #d6d9c7 0 14px, transparent 14px 24px)' }} />;
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-zm-dark font-bold whitespace-nowrap">{children}</th>;
}
export const inputCls = 'w-full px-3 py-2 bg-white text-zm-ink placeholder:text-zm-muted/70 border border-zm-neutral rounded-lg text-sm focus:ring-2 focus:ring-zm-blue focus:border-transparent outline-none disabled:bg-zm-paper disabled:text-zm-dark disabled:opacity-100';
export const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors';
export const btnPrimary = `${btn} bg-zm-blue text-white hover:bg-zm-accent`;
export const btnSoft = `${btn} bg-zm-blue/10 text-zm-blue hover:bg-zm-blue/20`;
export const btnGrey = `${btn} bg-zm-neutral/50 text-zm-dark hover:bg-zm-neutral`;
export const btnDanger = `${btn} bg-red-50 text-red-600 hover:bg-red-100`;

export function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="block text-[11px] font-bold text-zm-dark uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  );
}

// Right-hand panel (full screen on phones)
export function Drawer({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className={`h-full w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} bg-zm-paper shadow-2xl overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-zm-neutral px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <h2 className="font-black text-zm-ink">{title}</h2>
          <button onClick={onClose} className={btnGrey}>✕ Zavrieť</button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function ErrorLine({ error }: { error: string }) {
  return error ? <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p> : null;
}

export function ActivityList({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-zm-muted p-4">Zatiaľ žiadne záznamy.</p>;
  return (
    <ul className="divide-y divide-zm-line text-sm">
      {items.map(a => (
        <li key={a.id} className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-zm-muted text-xs whitespace-nowrap w-32">{dateTime(a.at)}</span>
          <span className="text-zm-muted text-xs w-24 truncate">{a.actor}</span>
          <span className="flex-1 min-w-[12rem]">
            {a.entity !== 'deal' && <b className="font-mono text-xs mr-1">{a.entity_id.length > 8 ? '' : a.entity_id}</b>}
            {a.field ? <>{FIELD_LABELS[a.field] || a.field}: <span className="text-red-600">{a.old_value || '—'}</span> → <span className="text-green-700">{a.new_value || '—'}</span></>
              : <>{actionLabel(a.action)} {a.new_value || a.old_value}</>}
            {a.note && <span className="text-zm-muted"> · {a.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
const actionLabel = (a: string) => ({ create: 'vytvorené', upload: 'nahraté', delete: 'zmazané', document: 'dokument', document_delete: 'zmazaný dokument', note: 'poznámka', password: 'zmena hesla', email: 'email' } as Record<string, string>)[a] || a;
