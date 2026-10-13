'use client';

import React, { useEffect, useState } from 'react';
import { Parking as Space, User, ST_LABELS, api, eur, StatusBadge, StageBadge, Card, Th, Drawer, Field, inputCls, btnPrimary, btnSoft, btnGrey, ErrorLine } from './shared';

type Plan = { src: string; w: number; h: number; title: string };
const STATUS_FILL: Record<string, string> = { available: '#16a34a', reserved: '#eab308', sold: '#dc2626', unavailable: '#9ca3af' };

// The plan (garage or outdoor) with every space drawn on it. In 'pick' mode the chosen ones are orange and the ones
// another deal holds can't be picked.
export function ParkingMap({ spaces, plan, selected, onPick, mode = 'manage', heldBy }: {
  spaces: Space[]; plan: string; selected?: Set<string>; onPick: (s: Space) => void; mode?: 'manage' | 'pick';
  heldBy?: (s: Space) => string | null;
}) {
  const [plans, setPlans] = useState<Record<string, Plan> | null>(null);
  const [hover, setHover] = useState<Space | null>(null);
  useEffect(() => { fetch('/parking/plans.json').then(r => r.json()).then(setPlans); }, []);
  const p = plans?.[plan];
  if (!p) return <div className="h-64 flex items-center justify-center text-zm-muted text-sm">Načítavam plán…</div>;

  return (
    <div className="relative">
      <div className="overflow-auto border border-zm-neutral rounded-lg bg-white">
        <svg viewBox={`0 0 ${p.w} ${p.h}`} className="w-full min-w-[640px] h-auto block select-none">
          <image href={p.src} x={0} y={0} width={p.w} height={p.h} />
          {spaces.filter(s => s.plan === plan && s.shape).map(s => {
            const sel = selected?.has(s.id);
            const held = mode === 'pick' && heldBy ? heldBy(s) : null;
            const fill = mode === 'pick' ? (sel ? '#ffa62b' : held || s.status !== 'available' ? '#9ca3af' : '#3091b2') : STATUS_FILL[s.status] || '#9ca3af';
            const pts = s.shape!.map(q => q.join(',')).join(' ');
            const cx = s.shape!.reduce((a, q) => a + q[0], 0) / s.shape!.length, cy = s.shape!.reduce((a, q) => a + q[1], 0) / s.shape!.length;
            return (
              <g key={s.id} onClick={() => onPick(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <polygon points={pts} fill={fill} fillOpacity={sel || hover?.id === s.id ? 0.7 : 0.38} stroke={sel ? '#c2410c' : fill} strokeWidth={sel ? 5 : 2} />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={plan === 'garaz' ? 34 : 26} fontWeight={700} fill="#1c1917" style={{ pointerEvents: 'none' }}>
                  {s.number}{s.accessible ? '♿' : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hover && (
        <div className="absolute top-2 left-2 bg-white/95 border border-zm-neutral shadow rounded-lg px-3 py-2 text-xs pointer-events-none">
          <b>{hover.label}</b> {hover.accessible && '· bezbariérové'} · {eur(hover.price)} · {ST_LABELS[hover.status]?.label}
          {hover.deals.length > 0 && <div className="text-zm-muted">v obchodoch: {hover.deals.map(d => d.unit_id).join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

export function PlanTabs({ plan, setPlan, spaces }: { plan: string; setPlan: (p: string) => void; spaces: Space[] }) {
  return (
    <div className="flex gap-1">
      {[['garaz', 'Garáž 1.PP'], ['exterier', 'Vonkajšie']].map(([k, l]) => (
        <button key={k} onClick={() => setPlan(k)} className={plan === k ? btnPrimary : btnGrey}>
          {l} <span className="opacity-70">({spaces.filter(s => s.plan === k && s.status === 'available').length} voľných)</span>
        </button>
      ))}
    </div>
  );
}

export default function Parking({ user, spaces, reload, openDeal }: { user: User; spaces: Space[]; reload: () => void; openDeal: (id: string) => void }) {
  const [plan, setPlan] = useState('garaz');
  const [edit, setEdit] = useState<Space | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [err, setErr] = useState('');
  const isAdmin = user.role === 'admin';
  const shown = spaces.filter(s => s.plan === plan);

  const togglePick = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (updates: Record<string, unknown>) => {
    setErr('');
    try { await api('/api/admin/parking', 'PATCH', { ids: [...picked], ...updates }); setPicked(new Set()); setBulkPrice(''); reload(); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card title="Parkovanie" actions={<><PlanTabs plan={plan} setPlan={setPlan} spaces={spaces} /><button onClick={reload} className={btnSoft}>↻</button></>}>
        <div className="p-3 sm:p-4 space-y-2">
          <div className="flex flex-wrap gap-3 text-xs text-zm-muted">
            {Object.entries(ST_LABELS).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: STATUS_FILL[k], opacity: 0.6 }} />{v.label}</span>)}
            <span>· kliknite na státie</span>
          </div>
          <ParkingMap spaces={spaces} plan={plan} onPick={s => setEdit(s)} selected={picked} />
        </div>
      </Card>

      <Card title={`Zoznam – ${plan === 'garaz' ? 'garáž' : 'vonkajšie'}`}
        actions={isAdmin && picked.size > 0 && <>
          <span className="text-xs text-zm-muted">Vybrané: {picked.size}</span>
          <input type="number" placeholder="Cena €" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} className="w-28 px-2 py-1 border rounded text-sm" />
          <button disabled={!bulkPrice} onClick={() => bulk({ price: Number(bulkPrice) })} className={btnPrimary}>Nastaviť cenu</button>
          <button onClick={() => bulk({ is_public: true })} className={btnGrey}>Na web</button>
          <button onClick={() => bulk({ is_public: false })} className={btnGrey}>Skryť z webu</button>
          <button onClick={() => setPicked(new Set())} className={btnGrey}>Zrušiť výber</button>
        </>}>
        <ErrorLine error={err} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-b border-zm-neutral">
              {isAdmin && <Th><input type="checkbox" checked={shown.length > 0 && shown.every(s => picked.has(s.id))} onChange={e => setPicked(e.target.checked ? new Set(shown.map(s => s.id)) : new Set())} /></Th>}
              {['', 'Názov', 'Cena', 'Stav', 'Na webe', 'Obchody', 'Poznámka'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {shown.map(s => (
                <tr key={s.id} className="border-b border-zm-line hover:bg-zm-paper cursor-pointer" onClick={() => setEdit(s)}>
                  {isAdmin && <td className="px-3" onClick={e => e.stopPropagation()}><input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} /></td>}
                  <td className="py-2 px-3 font-mono font-bold">{s.id}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{s.label}{s.accessible && ' ♿'}</td>
                  <td className="py-2 px-3 font-bold whitespace-nowrap">{eur(s.price)}</td>
                  <td className="py-2 px-3"><StatusBadge status={s.status} /></td>
                  <td className="py-2 px-3 text-xs">{s.is_public ? 'áno' : 'nie'}</td>
                  <td className="py-2 px-3"><div className="flex gap-1 flex-wrap">{s.deals.map(d => (
                    <button key={d.id} onClick={e => { e.stopPropagation(); openDeal(d.id); }} className="flex items-center gap-1 text-xs"><b>{d.unit_id}</b><StageBadge stage={d.stage} /></button>
                  ))}</div></td>
                  <td className="py-2 px-3 text-xs text-zm-muted max-w-xs truncate">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <SpaceEditor space={edit} isAdmin={isAdmin} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} openDeal={openDeal} />}
    </div>
  );
}

function SpaceEditor({ space, isAdmin, onClose, onSaved, openDeal }: { space: Space; isAdmin: boolean; onClose: () => void; onSaved: () => void; openDeal: (id: string) => void }) {
  const [d, setD] = useState<Record<string, any>>({ ...space });
  const [err, setErr] = useState('');
  const save = async () => {
    const fields = isAdmin ? ['label', 'price', 'status', 'is_public', 'accessible', 'notes'] : ['status', 'notes'];
    const ch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = f === 'price' ? (d.price === '' || d.price == null ? null : Number(d.price)) : d[f];
      if (String(v ?? '') !== String((space as any)[f] ?? '')) ch[f] = v;
    }
    try { if (Object.keys(ch).length) await api(`/api/admin/parking/${space.id}`, 'PATCH', ch); onSaved(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Drawer title={<>{space.id} · {space.label}</>} onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-3 bg-white border border-zm-neutral rounded-xl p-4">
        <Field label="Stav">
          <select className={inputCls} value={d.status} onChange={e => setD({ ...d, status: e.target.value })}>
            {Object.entries(ST_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Cena s DPH (€)"><input type="number" className={inputCls} disabled={!isAdmin} value={d.price ?? ''} onChange={e => setD({ ...d, price: e.target.value })} /></Field>
        <Field label="Názov"><input className={inputCls} disabled={!isAdmin} value={d.label} onChange={e => setD({ ...d, label: e.target.value })} /></Field>
        <div className="flex flex-col justify-end gap-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!isAdmin} checked={d.is_public} onChange={e => setD({ ...d, is_public: e.target.checked })} /> Na webe</label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!isAdmin} checked={d.accessible} onChange={e => setD({ ...d, accessible: e.target.checked })} /> Bezbariérové</label>
        </div>
        <Field label="Poznámka (interná)" wide><textarea rows={2} className={inputCls} value={d.notes ?? ''} onChange={e => setD({ ...d, notes: e.target.value })} /></Field>
      </div>
      {space.deals.length > 0 && (
        <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-1 text-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">V obchodoch</h3>
          {space.deals.map(dl => <button key={dl.id} onClick={() => openDeal(dl.id)} className="flex gap-2 items-center hover:underline"><b>{dl.unit_id}</b><StageBadge stage={dl.stage} /> {eur(dl.price)}</button>)}
        </div>
      )}
      <ErrorLine error={err} />
      <div className="flex gap-2"><button onClick={save} className={btnPrimary}>Uložiť</button><button onClick={onClose} className={btnGrey}>Zrušiť</button></div>
    </Drawer>
  );
}
