'use client';

import React, { useState } from 'react';
import { Unit, User, ST_LABELS, api, eur, fmt, StatusBadge, StageBadge, Card, Th, Drawer, Field, inputCls, btnPrimary, btnSoft, btnGrey, ErrorLine, customerName, dateTime } from './shared';

type Change = { id: number; field_name: string; old_value: string; new_value: string; changed_by: string; changed_at: string };

const NUM = ['rooms_count', 'interior_area', 'gallery_area', 'exterior_area', 'total_area', 'area_with_podium', 'price', 'sort_order'];

export default function Units({ user, units, reload, openDeal }: { user: User; units: Unit[]; reload: () => void; openDeal: (id: string) => void }) {
  const [edit, setEdit] = useState<Unit | null>(null);
  const [filter, setFilter] = useState('');
  const isAdmin = user.role === 'admin';
  const shown = units.filter(u => !filter || u.status === filter);
  const count = (s: string) => units.filter(u => u.status === s && u.is_public).length;

  return (
    <>
      <Card title={<>Jednotky <span className="text-zm-muted font-normal">({units.filter(u => u.is_public).length} na webe)</span></>}
        actions={<>
          {['', 'available', 'reserved', 'sold'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={filter === s ? btnPrimary : btnGrey}>
              {s ? `${ST_LABELS[s].label} ${count(s)}` : 'Všetky'}
            </button>
          ))}
          <button onClick={reload} className={btnSoft}>↻</button>
        </>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-b border-zm-neutral">
              {['', 'Názov', 'NP', 'Typ', 'Izby', 'Interiér', 'Galéria', 'Ext.', 'Spolu', 'Cena', '€/m²', 'Stav', 'Obchod'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {shown.map(u => (
                <tr key={u.id} onClick={() => setEdit(u)} className={`border-b border-zm-line hover:bg-zm-paper cursor-pointer ${u.is_public ? '' : 'opacity-40'}`}>
                  <td className="py-2 px-3 font-mono font-bold text-zm-ink">{u.id}</td>
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{u.name}</td>
                  <td className="py-2 px-3 text-zm-dark">{u.floor_number}</td>
                  <td className="py-2 px-3 text-zm-muted text-xs">{u.layout || u.unit_type}</td>
                  <td className="py-2 px-3">{u.rooms}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{fmt(u.interior_area)}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-zm-muted">{u.gallery_area ? fmt(u.gallery_area) : ''}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-zm-muted">{u.exterior_area ? fmt(u.exterior_area) : ''}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{fmt(u.total_area)} m²</td>
                  <td className="py-2 px-3 font-bold whitespace-nowrap">{eur(u.price)}</td>
                  <td className="py-2 px-3 text-zm-muted text-xs whitespace-nowrap">{eur(u.price_per_m2)}</td>
                  <td className="py-2 px-3"><StatusBadge status={u.status} /></td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {u.deals.map(d => (
                        <button key={d.id} onClick={e => { e.stopPropagation(); openDeal(d.id); }} title={d.deal_customers?.map(c => customerName(c.customers)).join(', ')}>
                          <StageBadge stage={d.stage} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <UnitEditor unit={edit} isAdmin={isAdmin} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} openDeal={openDeal} />}
    </>
  );
}

function UnitEditor({ unit, isAdmin, onClose, onSaved, openDeal }: { unit: Unit; isAdmin: boolean; onClose: () => void; onSaved: () => void; openDeal: (id: string) => void }) {
  const [d, setD] = useState<Record<string, any>>({ ...unit });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Change[] | null>(null);
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr('');
    const fields = isAdmin ? ['name', 'rooms', 'rooms_count', 'layout', 'view_type', 'orientation', 'interior_area', 'gallery_area', 'exterior_area',
      'exterior_type', 'total_area', 'area_with_podium', 'price', 'status', 'is_public', 'description', 'walkthrough_url', 'sort_order'] : ['status'];
    const changes: Record<string, any> = {};
    for (const f of fields) {
      let v = d[f];
      if (NUM.includes(f)) v = v === '' || v == null ? null : Number(v);
      if (String(v ?? '') !== String((unit as any)[f] ?? '')) changes[f] = v === '' ? null : v;
    }
    try { if (Object.keys(changes).length) await api(`/api/admin/units/${unit.id}`, 'PATCH', changes); onSaved(); }
    catch (e: any) { setErr(e.message); }
    setSaving(false);
  };
  const txt = (k: string, label: string, wide = false) => (
    <Field label={label} wide={wide}><input className={inputCls} disabled={!isAdmin} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} /></Field>
  );
  const num = (k: string, label: string) => (
    <Field label={label}><input type="number" step="0.01" className={inputCls} disabled={!isAdmin} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} /></Field>
  );

  return (
    <Drawer title={<>{unit.id} · {unit.name}</>} onClose={onClose}>
      {!isAdmin && <p className="text-xs text-zm-muted bg-white border border-zm-neutral rounded-lg p-3">Ako maklér meníte stav jednotky. Cenu a plochy mení administrátor. Rezervácie a predaj najlepšie cez <b>Obchody</b> – stav jednotky sa nastaví sám.</p>}
      <div className="grid sm:grid-cols-2 gap-3 bg-white border border-zm-neutral rounded-xl p-4">
        <Field label="Stav">
          <select className={inputCls} value={d.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(ST_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        {num('price', 'Cena s DPH (€)')}
        {txt('name', 'Názov')}
        {txt('layout', 'Typ (klasická / loft)')}
        {txt('rooms', 'Izbovosť (text)')}
        {num('rooms_count', 'Počet izieb')}
        {txt('view_type', 'Výhľad')}
        {txt('orientation', 'Orientácia')}
        {num('interior_area', 'Interiér m²')}
        {num('gallery_area', 'Galéria m²')}
        {num('exterior_area', 'Exteriér m²')}
        {txt('exterior_type', 'Typ exteriéru')}
        {num('total_area', 'Spolu m² (cena/m²)')}
        {num('area_with_podium', 'Výmera s pódiom m²')}
        {txt('walkthrough_url', '3D prehliadka (URL)', true)}
        <Field label="Popis" wide><textarea rows={3} className={inputCls} disabled={!isAdmin} value={d.description ?? ''} onChange={e => set('description', e.target.value)} /></Field>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={!!d.is_public} onChange={e => set('is_public', e.target.checked)} /> Zobraziť na webe
          </label>
        )}
      </div>
      <ErrorLine error={err} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Ukladám…' : 'Uložiť'}</button>
        <button onClick={onClose} className={btnGrey}>Zrušiť</button>
        <button onClick={async () => setHistory((await api(`/api/admin/units/${unit.id}`)).history)} className={`${btnGrey} ml-auto`}>História zmien</button>
      </div>
      {unit.deals.length > 0 && (
        <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Obchody</h3>
          {unit.deals.map(dl => (
            <button key={dl.id} onClick={() => openDeal(dl.id)} className="flex items-center gap-2 text-sm hover:underline">
              <StageBadge stage={dl.stage} /> {dl.deal_customers?.map(c => customerName(c.customers)).join(', ') || '(bez klienta)'}
            </button>
          ))}
        </div>
      )}
      {history && (
        <div className="bg-white border border-zm-neutral rounded-xl overflow-hidden">
          {history.length === 0 ? <p className="p-4 text-sm text-zm-muted">Žiadne zmeny.</p> : (
            <table className="w-full text-sm"><tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b border-zm-line">
                  <td className="px-3 py-2 text-xs text-zm-muted whitespace-nowrap">{dateTime(h.changed_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{h.field_name}</td>
                  <td className="px-3 py-2 text-xs"><span className="text-red-600">{h.old_value || '—'}</span> → <span className="text-green-700">{h.new_value || '—'}</span></td>
                  <td className="px-3 py-2 text-xs text-zm-muted">{h.changed_by}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}
    </Drawer>
  );
}
