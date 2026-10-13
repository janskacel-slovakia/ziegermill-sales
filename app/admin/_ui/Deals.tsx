'use client';

import React, { useEffect, useState } from 'react';
import {
  Deal, Unit, Parking as Space, Customer, User, Doc, Stage, STAGE_LABELS, STAGE_ORDER, KIND_LABELS, SOURCE_LABELS, api, eur, date, dateTime,
  customerName, StageBadge, StatusBadge, Card, Th, Drawer, Field, inputCls, btnPrimary, btnSoft, btnGrey, btnDanger, ErrorLine, ActivityList,
  uploadFile, downloadUrl, Spinner,
} from './shared';
import { CustomerPicker } from './Customers';
import { ParkingMap, PlanTabs } from './Parking';

const HOLDING: Stage[] = ['reserved', 'future_contract', 'purchase_contract', 'sold'];

export default function Deals({ user, deals, units, spaces, reload, open, setOpen }: {
  user: User; deals: Deal[]; units: Unit[]; spaces: Space[]; reload: () => void; open: string | null; setOpen: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<'active' | Stage>('active');
  const shown = deals.filter(d => (filter === 'active' ? !['sold', 'cancelled'].includes(d.stage) : d.stage === filter));
  const count = (s: Stage) => deals.filter(d => d.stage === s).length;

  return (
    <>
      <Card title="Obchody" actions={<>
        <button onClick={() => setFilter('active')} className={filter === 'active' ? btnPrimary : btnGrey}>Rozpracované</button>
        {STAGE_ORDER.map(s => count(s) > 0 && <button key={s} onClick={() => setFilter(s)} className={filter === s ? btnPrimary : btnGrey}>{STAGE_LABELS[s].label} {count(s)}</button>)}
        <button onClick={() => setOpen('new')} className={btnPrimary}>+ Nový obchod</button>
      </>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-b border-zm-neutral">{['Jednotka', 'Klient', 'Fáza', 'Parkovanie', 'Cena', 'Rezervácia do', 'Maklér', 'Zmenené'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {shown.map(d => {
                const late = d.stage === 'reserved' && d.reserved_until && d.reserved_until < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={d.id} onClick={() => setOpen(d.id)} className="border-b border-zm-line hover:bg-zm-paper cursor-pointer">
                    <td className="py-2 px-3 font-mono font-bold">{d.unit_id}</td>
                    <td className="py-2 px-3">{d.deal_customers.map(c => customerName(c.customers)).join(', ') || <span className="text-zm-muted">—</span>}</td>
                    <td className="py-2 px-3"><StageBadge stage={d.stage} /></td>
                    <td className="py-2 px-3 text-xs">{d.deal_parking.map(p => p.parking_spaces.id).join(', ')}</td>
                    <td className="py-2 px-3 font-bold whitespace-nowrap">{eur((d.price || 0) + d.deal_parking.reduce((a, p) => a + (p.price || 0), 0))}</td>
                    <td className={`py-2 px-3 text-xs whitespace-nowrap ${late ? 'text-red-600 font-bold' : ''}`}>{d.stage === 'reserved' ? date(d.reserved_until) : ''}{late && ' ⚠'}</td>
                    <td className="py-2 px-3 text-xs text-zm-muted">{d.agent?.display_name}</td>
                    <td className="py-2 px-3 text-xs text-zm-muted whitespace-nowrap">{date(d.updated_at)}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-zm-muted">Žiadne obchody.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <DealEditor key={open} id={open === 'new' ? null : open} user={user} units={units} spaces={spaces}
        onClose={() => setOpen(null)} onSaved={(id) => { reload(); if (id) setOpen(id); }} />}
    </>
  );
}

function DealEditor({ id, user, units, spaces, onClose, onSaved }: {
  id: string | null; user: User; units: Unit[]; spaces: Space[]; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const isAdmin = user.role === 'admin';
  const [deal, setDeal] = useState<Deal | null>(null);
  const [unitId, setUnitId] = useState('');
  const [clients, setClients] = useState<Customer[]>([]);
  const [parking, setParking] = useState<{ id: string; price: number | null }[]>([]);
  const [d, setD] = useState<Record<string, any>>({});
  const [plan, setPlan] = useState('garaz');
  const [showMap, setShowMap] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingStage, setPendingStage] = useState<Stage | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    if (!id) return;
    const x = await api<Deal>(`/api/admin/deals/${id}`);
    setDeal(x); setUnitId(x.unit_id); setClients(x.deal_customers.sort((a, b) => a.position - b.position).map(c => c.customers));
    setParking(x.deal_parking.map(p => ({ id: p.parking_spaces.id, price: p.price })));
    setD({ stage: x.stage, price: x.price, reservation_fee: x.reservation_fee, reserved_at: x.reserved_at, reserved_until: x.reserved_until,
      future_contract_at: x.future_contract_at, purchase_contract_at: x.purchase_contract_at, notes: x.notes, commission_rate: x.commission_rate });
  };
  useEffect(() => { load().catch(e => setErr(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unit = units.find(u => u.id === unitId);
  const spaceById = Object.fromEntries(spaces.map(s => [s.id, s]));
  const heldBy = (s: Space) => s.deals.find(x => x.id !== id && HOLDING.includes(x.stage))?.unit_id ?? null;
  const togglePark = (s: Space) => {
    if (parking.some(p => p.id === s.id)) return setParking(parking.filter(p => p.id !== s.id));
    const h = heldBy(s);
    if (h) return setErr(`${s.label} už drží obchod na ${h}`);
    if (s.status === 'unavailable') return setErr(`${s.label} nie je v predaji`);
    setErr(''); setParking([...parking, { id: s.id, price: s.price }]);
  };
  const total = (Number(d.price ?? unit?.price) || 0) + parking.reduce((a, p) => a + (Number(p.price) || 0), 0);

  const save = async (extra: Record<string, unknown> = {}): Promise<boolean> => {
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = { customer_ids: clients.map(c => c.id), parking: parking.map(p => ({ id: p.id, price: p.price })), ...extra };
      if (!id) {
        const created = await api<Deal>('/api/admin/deals', 'POST', { unit_id: unitId, stage: d.stage || 'offer', notes: d.notes, commission_rate: d.commission_rate ?? null, ...(isAdmin && d.price != null && d.price !== '' ? { price: Number(d.price) } : {}), ...body });
        onSaved(created.id); return true;
      }
      for (const k of ['stage', 'reserved_at', 'reserved_until', 'future_contract_at', 'purchase_contract_at', 'notes', 'commission_rate', ...(isAdmin ? ['price', 'reservation_fee'] : [])])
        if (String(d[k] ?? '') !== String((deal as any)[k] ?? '')) body[k] = ['price', 'reservation_fee'].includes(k) && d[k] !== '' && d[k] != null ? Number(d[k]) : d[k];
      if (note.trim()) body.note = note.trim();
      await api(`/api/admin/deals/${id}`, 'PATCH', body);
      setNote(''); onSaved(); await load();
      setSaving(false); return true;
    } catch (e: any) { setErr(e.message); }
    setSaving(false); return false;
  };

  const nextStage = async (s: Stage) => {
    if (s === 'cancelled' && !confirm('Zrušiť obchod? Jednotka a státia sa uvoľnia.')) return;
    const was = d.stage;
    setD(p => ({ ...p, stage: s }));
    if (!id) return;
    setPendingStage(s);
    const ok = await save({ stage: s });
    setPendingStage(null);
    if (!ok) setD(p => ({ ...p, stage: was }));
  };

  return (
    <Drawer wide title={id ? <>{unitId} · {clients.map(customerName).join(', ') || 'obchod'}</> : 'Nový obchod'} onClose={onClose}>
      {id && deal && (
        <div className="bg-white border border-zm-neutral rounded-xl p-3 flex flex-wrap gap-1 items-center">
          {STAGE_ORDER.map(s => {
            const current = pendingStage ? pendingStage === s : deal.stage === s;
            return (
              <button key={s} disabled={saving || deal.stage === s} onClick={() => nextStage(s)}
                className={`${current ? 'text-white' : 'bg-zm-neutral/50 text-zm-dark hover:bg-zm-neutral'} ${saving ? 'cursor-wait' : ''} ${pendingStage === s ? 'animate-pulse' : ''} px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5`}
                style={current ? { background: STAGE_LABELS[s].color } : undefined}>
                {pendingStage === s && <Spinner className="w-3 h-3" />}{STAGE_LABELS[s].label}
              </button>
            );
          })}
          {pendingStage && <span className="text-xs text-zm-muted ml-2">Ukladám… (mení sa aj stav jednotky a státí)</span>}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Jednotka</h3>
          {id ? (
            <p className="text-sm"><b>{unit?.name}</b> · {unit?.floor_number}. NP · {unit?.rooms} · {unit?.total_area} m² · cenník {eur(unit?.price)} {unit && <StatusBadge status={unit.status} />}</p>
          ) : (
            <select className={inputCls} value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">— vyberte —</option>
              {units.filter(u => u.is_public).map(u => <option key={u.id} value={u.id} disabled={u.status === 'sold'}>{u.id} · {u.name} · {u.rooms} · {eur(u.price)} · {u.status === 'available' ? 'voľný' : u.status === 'reserved' ? 'rezervovaný' : 'predaný'}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dohodnutá cena (€)">
              <input type="number" className={inputCls} disabled={!isAdmin} placeholder={unit ? String(unit.price) : ''} value={d.price ?? ''} onChange={e => setD({ ...d, price: e.target.value })} />
            </Field>
            <Field label="Rezervačný poplatok (€)">
              <input type="number" className={inputCls} disabled={!isAdmin} value={d.reservation_fee ?? 5000} onChange={e => setD({ ...d, reservation_fee: e.target.value })} />
            </Field>
          </div>
          {!isAdmin && <p className="text-xs text-zm-muted">Cenu mení administrátor (zľavy po dohode s Janom).</p>}
          <Field label="Provízia makléra (bez DPH)">
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="commission" checked={d.commission_rate == null} onChange={() => setD({ ...d, commission_rate: null })} className="accent-[#3091b2]" /> 1,25 % – štandardný predaj</label>
              <label className="flex items-center gap-2"><input type="radio" name="commission" checked={d.commission_rate != null} onChange={() => setD({ ...d, commission_rate: 0.015 })} className="accent-[#3091b2]" /> 1,5 % – komplikovaný prípad (nadštandardné požiadavky klienta, úpravy, zmena stratégie)</label>
            </div>
          </Field>
          {!id && (
            <Field label="Fáza">
              <select className={inputCls} value={d.stage || 'offer'} onChange={e => setD({ ...d, stage: e.target.value })}>
                {STAGE_ORDER.filter(s => s !== 'cancelled' && s !== 'sold').map(s => <option key={s} value={s}>{STAGE_LABELS[s].label}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Klienti (kupujúci)</h3>
          <CustomerPicker value={clients} onChange={setClients} />
        </div>
      </div>

      <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Parkovanie</h3>
          <button onClick={() => setShowMap(!showMap)} className={btnSoft}>{showMap ? 'Skryť plán' : 'Vybrať na pláne'}</button>
        </div>
        {parking.length === 0 && <p className="text-sm text-zm-muted">Bez parkovania.</p>}
        {parking.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <b className="font-mono w-10">{p.id}</b><span className="flex-1">{spaceById[p.id]?.label}{spaceById[p.id]?.accessible && ' ♿'}</span>
            <input type="number" disabled={!isAdmin} value={p.price ?? ''} onChange={e => setParking(parking.map((x, j) => j === i ? { ...x, price: e.target.value === '' ? null : Number(e.target.value) } : x))} className="w-28 px-2 py-1 border rounded text-sm disabled:bg-zm-paper" />
            <span className="text-xs text-zm-muted">€</span>
            <button onClick={() => setParking(parking.filter(x => x.id !== p.id))} className={btnGrey}>✕</button>
          </div>
        ))}
        {showMap && (
          <div className="space-y-2">
            <PlanTabs plan={plan} setPlan={setPlan} spaces={spaces} />
            <p className="text-xs text-zm-muted">Modré = voľné · oranžové = vybrané · sivé = obsadené / nedostupné.</p>
            <ParkingMap spaces={spaces} plan={plan} mode="pick" selected={new Set(parking.map(p => p.id))} onPick={togglePark} heldBy={heldBy} />
          </div>
        )}
        <p className="text-sm text-right">Spolu: <b>{eur(total)}</b></p>
      </div>

      {id && (
        <div className="bg-white border border-zm-neutral rounded-xl p-4 grid sm:grid-cols-2 gap-3">
          <Field label="Rezervované dňa"><input type="date" className={inputCls} value={d.reserved_at ?? ''} onChange={e => setD({ ...d, reserved_at: e.target.value })} /></Field>
          <Field label="Rezervácia platí do"><input type="date" className={inputCls} value={d.reserved_until ?? ''} onChange={e => setD({ ...d, reserved_until: e.target.value })} /></Field>
          <Field label="ZOBZ podpísaná"><input type="date" className={inputCls} value={d.future_contract_at ?? ''} onChange={e => setD({ ...d, future_contract_at: e.target.value })} /></Field>
          <Field label="KZ podpísaná"><input type="date" className={inputCls} value={d.purchase_contract_at ?? ''} onChange={e => setD({ ...d, purchase_contract_at: e.target.value })} /></Field>
        </div>
      )}
      <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-3">
        <Field label="Poznámky k obchodu"><textarea rows={3} className={inputCls} value={d.notes ?? ''} onChange={e => setD({ ...d, notes: e.target.value })} /></Field>
        {id && <Field label="Záznam do histórie (telefonát, stretnutie…)"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="napr. Klient chce 2. státie, ozve sa v piatok" /></Field>}
      </div>

      <ErrorLine error={err} />
      <div className="flex gap-2">
        <button onClick={() => save()} disabled={saving || (!id && !unitId)} className={btnPrimary}>{saving ? <><Spinner className="w-3 h-3 mr-1" />Ukladám…</> : id ? 'Uložiť' : 'Vytvoriť obchod'}</button>
        <button onClick={onClose} className={btnGrey}>Zavrieť</button>
        {id && isAdmin && <button onClick={async () => {
          if (!confirm('Zmazať obchod natrvalo aj s dokumentmi? (Skončený obchod radšej označte „Zrušené“.)')) return;
          try { await api(`/api/admin/deals/${id}`, 'DELETE'); onClose(); onSaved(); } catch (e: any) { setErr(e.message); }
        }} className={`${btnDanger} ml-auto`}>Zmazať obchod</button>}
      </div>

      {id && deal && <Documents dealId={id} user={user} docs={deal.documents || []} reload={load} />}
      {id && deal && (
        <div className="bg-white border border-zm-neutral rounded-xl">
          <h3 className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-zm-muted">História obchodu · založil {deal.created_by} {dateTime(deal.created_at)}</h3>
          <ActivityList items={deal.activity || []} />
        </div>
      )}
    </Drawer>
  );
}

function Documents({ dealId, user, docs, reload }: { dealId: string; user: User; docs: Doc[]; reload: () => Promise<void> }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<{ file: File | null; kind: string; title: string; source: string; notes: string }>({ file: null, kind: 'RZ', title: '', source: 'custom', notes: '' });

  const run = async (f: () => Promise<unknown>) => { setBusy(true); setErr(''); try { await f(); await reload(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const fromTemplates = () => run(() => api(`/api/admin/deals/${dealId}/documents`, 'POST', { from_templates: 'current' }));
  const upload = () => run(async () => {
    if (!up.file) throw new Error('Vyberte súbor');
    const f = await uploadFile(`deals/${dealId}`, up.file);
    await api(`/api/admin/deals/${dealId}/documents`, 'POST', { ...f, kind: up.kind, title: up.title || KIND_LABELS[up.kind] || up.file.name, source: up.source, notes: up.notes });
    setUp({ ...up, file: null, title: '', notes: '' });
  });
  const remove = (doc: Doc) => confirm(`Zmazať „${doc.title}“ (${doc.file_name})?`) && run(() => api(`/api/admin/deals/${dealId}/documents?doc=${doc.id}`, 'DELETE'));

  return (
    <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Dokumenty pre klienta</h3>
        <button onClick={fromTemplates} disabled={busy} className={btnSoft}>Pridať platné šablóny (všeobecný návrh)</button>
      </div>
      <p className="text-xs text-zm-muted">Postup: pridajte platné šablóny → stiahnite, upravte pre klienta vo Worde → nahrajte ako „upravené pre klienta“. Podpísané skeny nahrajte ako „podpísané“.</p>
      {docs.length === 0 ? <p className="text-sm text-zm-muted">Zatiaľ žiadne dokumenty.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zm-neutral">{['Dokument', 'Verzia', 'Súbor', 'Pridal', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc.id} className="border-b border-zm-line">
                <td className="py-2 px-3"><b>{doc.title}</b>{doc.notes && <div className="text-xs text-zm-muted">{doc.notes}</div>}</td>
                <td className="py-2 px-3 text-xs whitespace-nowrap">{SOURCE_LABELS[doc.source] || doc.source}</td>
                <td className="py-2 px-3 text-xs"><a className="text-zm-blue hover:underline break-all" href={downloadUrl(doc.storage_path, doc.file_name)}>{doc.file_name}</a></td>
                <td className="py-2 px-3 text-xs text-zm-muted whitespace-nowrap">{doc.uploaded_by}<br />{dateTime(doc.created_at)}</td>
                <td className="py-2 px-3 text-right">{(user.role === 'admin' || doc.uploaded_by === user.username) && <button onClick={() => remove(doc)} className={btnDanger}>Zmazať</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid sm:grid-cols-2 gap-2 border-t border-zm-line pt-3">
        <Field label="Druh">
          <select className={inputCls} value={up.kind} onChange={e => setUp({ ...up, kind: e.target.value })}>{Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Verzia">
          <select className={inputCls} value={up.source} onChange={e => setUp({ ...up, source: e.target.value })}>{Object.entries(SOURCE_LABELS).filter(([k]) => k !== 'template').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Názov (nepovinné)"><input className={inputCls} value={up.title} onChange={e => setUp({ ...up, title: e.target.value })} placeholder={KIND_LABELS[up.kind]} /></Field>
        <Field label="Poznámka"><input className={inputCls} value={up.notes} onChange={e => setUp({ ...up, notes: e.target.value })} placeholder="napr. upravený termín splatnosti" /></Field>
        <input type="file" onChange={e => setUp({ ...up, file: e.target.files?.[0] || null })} className="text-sm sm:col-span-2" />
        <div><button onClick={upload} disabled={busy || !up.file} className={btnPrimary}>{busy ? <><Spinner className="w-3 h-3 mr-1" />Pracujem…</> : 'Nahrať'}</button></div>
      </div>
      <ErrorLine error={err} />
    </div>
  );
}
