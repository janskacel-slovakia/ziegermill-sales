'use client';

import React, { useEffect, useState } from 'react';
import { Customer, Activity, Spinner, api, customerName, date, dateTime, StageBadge, Card, Th, Drawer, Field, inputCls, btnPrimary, btnSoft, btnGrey, btnDanger, ErrorLine, ActivityList } from './shared';

type Lead = { id: number; name: string; email: string; phone: string; created_at: string; customer_id: string | null };

export default function Customers({ openDeal, canDelete }: { openDeal: (id: string) => void; canDelete?: boolean }) {
  const [list, setList] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Customer> | null>(null);
  const [view, setView] = useState<'clients' | 'leads'>('clients');

  const load = () => {
    api<Customer[]>(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setList).catch(() => {});
    api<Lead[]>('/api/admin/leads').then(setLeads).catch(() => {});
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromLead = (l: Lead) => {
    const parts = (l.name || '').trim().split(/\s+/);
    setEdit({ kind: 'person', first_name: parts.slice(0, -1).join(' ') || null, last_name: parts.at(-1) || null, email: l.email, phone: l.phone, lead_id: l.id, source: 'web' });
  };

  return (
    <>
      <Card title={<div className="flex gap-1">
          <button onClick={() => setView('clients')} className={view === 'clients' ? btnPrimary : btnGrey}>Klienti ({list.length})</button>
          <button onClick={() => setView('leads')} className={view === 'leads' ? btnPrimary : btnGrey}>Kontakty z webu ({leads.filter(l => !l.customer_id).length} nových)</button>
        </div>}
        actions={view === 'clients' && <>
          <input placeholder="Hľadať meno, email, telefón…" value={q} onChange={e => setQ(e.target.value)} className="px-3 py-1.5 border border-zm-neutral rounded-lg text-sm w-56" />
          <button onClick={() => setEdit({ kind: 'person' })} className={btnPrimary}>+ Nový klient</button>
        </>}>
        <div className="overflow-x-auto">
          {view === 'clients' ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-zm-paper border-b border-zm-neutral">{['Meno / firma', 'Email', 'Telefón', 'Obchody', 'Zdroj', 'Pridaný'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id} onClick={() => setEdit(c)} className="border-b border-zm-line hover:bg-zm-paper cursor-pointer">
                    <td className="py-2 px-3 font-medium">{customerName(c)}</td>
                    <td className="py-2 px-3 text-zm-dark">{c.email}</td>
                    <td className="py-2 px-3 text-zm-dark whitespace-nowrap">{c.phone}</td>
                    <td className="py-2 px-3"><div className="flex flex-wrap gap-1">{c.deal_customers?.map(dc => (
                      <button key={dc.deals.id} onClick={e => { e.stopPropagation(); openDeal(dc.deals.id); }} className="flex items-center gap-1 text-xs"><b>{dc.deals.unit_id}</b><StageBadge stage={dc.deals.stage} /></button>
                    ))}</div></td>
                    <td className="py-2 px-3 text-xs text-zm-muted">{c.source}</td>
                    <td className="py-2 px-3 text-xs text-zm-muted">{date(c.created_at)}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-zm-muted">Zatiaľ žiadni klienti.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-zm-paper border-b border-zm-neutral">{['Dátum', 'Meno', 'Email', 'Telefón', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id} className="border-b border-zm-line">
                    <td className="py-2 px-3 text-xs text-zm-muted whitespace-nowrap">{dateTime(l.created_at)}</td>
                    <td className="py-2 px-3">{l.name}</td>
                    <td className="py-2 px-3">{l.email}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{l.phone}</td>
                    <td className="py-2 px-3 text-right">{l.customer_id ? <span className="text-xs text-green-700">✓ klient</span> : <button onClick={() => fromLead(l)} className={btnSoft}>Vytvoriť klienta</button>}</td>
                  </tr>
                ))}
                {leads.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zm-muted">Žiadne kontakty z webu.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      {edit && <CustomerEditor customer={edit} canDelete={canDelete} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} openDeal={openDeal} />}
    </>
  );
}

export function CustomerEditor({ customer, onClose, onSaved, openDeal, canDelete }: { customer: Partial<Customer>; onClose: () => void; onSaved: (c: Customer) => void; openDeal?: (id: string) => void; canDelete?: boolean }) {
  const [d, setD] = useState<Record<string, any>>({ kind: 'person', ...customer });
  const [err, setErr] = useState('');
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const isNew = !customer.id;
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));
  const f = (k: string, label: string, opts: { type?: string; wide?: boolean } = {}) => (
    <Field label={label} wide={opts.wide}><input type={opts.type || 'text'} className={inputCls} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} /></Field>
  );

  useEffect(() => { if (!isNew) api(`/api/admin/customers/${customer.id}`).then(c => setActivity(c.activity)).catch(() => {}); }, [customer.id, isNew]);

  const save = async () => {
    setErr('');
    const fields = ['kind', 'title', 'first_name', 'last_name', 'birth_surname', 'birth_date', 'birth_number', 'nationality', 'address',
      'correspondence_address', 'email', 'phone', 'iban', 'company_name', 'ico', 'dic', 'ic_dph', 'registry', 'statutory', 'lead_id', 'source', 'notes'];
    const body: Record<string, any> = {};
    for (const k of fields) if (isNew ? d[k] != null && d[k] !== '' : String(d[k] ?? '') !== String((customer as any)[k] ?? '')) body[k] = d[k];
    try {
      const c = isNew ? await api<Customer>('/api/admin/customers', 'POST', body) : await api<Customer>(`/api/admin/customers/${customer.id}`, 'PATCH', body);
      onSaved(c);
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <Drawer title={isNew ? 'Nový klient' : customerName(customer)} onClose={onClose}>
      <div className="flex gap-1">
        {[['person', 'Fyzická osoba'], ['company', 'Firma']].map(([k, l]) => <button key={k} onClick={() => set('kind', k)} className={d.kind === k ? btnPrimary : btnGrey}>{l}</button>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 bg-white border border-zm-neutral rounded-xl p-4">
        {d.kind === 'company' && <>{f('company_name', 'Obchodné meno', { wide: true })}{f('ico', 'IČO')}{f('dic', 'DIČ')}{f('ic_dph', 'IČ DPH')}{f('registry', 'Zápis v OR')}{f('statutory', 'Štatutárny orgán', { wide: true })}</>}
        {f('title', 'Titul')}
        {f('first_name', 'Meno')}
        {f('last_name', 'Priezvisko')}
        {d.kind === 'person' && f('birth_surname', 'Rodné priezvisko')}
        {f('email', 'Email', { type: 'email' })}
        {f('phone', 'Telefón', { type: 'tel' })}
        {f('address', d.kind === 'company' ? 'Sídlo' : 'Trvalý pobyt', { wide: true })}
        {f('correspondence_address', 'Korešpondenčná adresa', { wide: true })}
        {f('source', 'Zdroj (web, telefón, odporúčanie…)')}
        <Field label="Poznámky" wide><textarea rows={3} className={inputCls} value={d.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <details className="bg-white border border-zm-neutral rounded-xl p-4" open={!!(d.birth_number || d.iban || d.birth_date)}>
        <summary className="text-xs font-bold uppercase tracking-wider text-zm-muted cursor-pointer">Údaje do zmlúv (osobné)</summary>
        <p className="text-xs text-zm-muted mt-2">Vidia ich len prihlásení používatelia administrácie; v histórii sa nezapisujú.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {d.kind === 'person' && <>{f('birth_date', 'Dátum narodenia', { type: 'date' })}{f('birth_number', 'Rodné číslo')}{f('nationality', 'Štátna príslušnosť')}</>}
          {f('iban', 'IBAN', { wide: d.kind === 'company' })}
        </div>
      </details>
      <ErrorLine error={err} />
      <div className="flex gap-2"><button onClick={save} className={btnPrimary}>{isNew ? 'Vytvoriť' : 'Uložiť'}</button><button onClick={onClose} className={btnGrey}>Zrušiť</button>
        {!isNew && canDelete && <button onClick={async () => {
          if (!confirm(`Zmazať klienta ${customerName(customer)}?`)) return;
          try { await api(`/api/admin/customers/${customer.id}`, 'DELETE'); onSaved(customer as Customer); } catch (e: any) { setErr(e.message); }
        }} className={`${btnDanger} ml-auto`}>Zmazať klienta</button>}
      </div>
      {!isNew && customer.deal_customers && customer.deal_customers.length > 0 && openDeal && (
        <div className="bg-white border border-zm-neutral rounded-xl p-4 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zm-muted">Obchody</h3>
          {customer.deal_customers.map(dc => <button key={dc.deals.id} onClick={() => openDeal(dc.deals.id)} className="flex gap-2 items-center text-sm hover:underline"><b>{dc.deals.unit_id}</b><StageBadge stage={dc.deals.stage} /></button>)}
        </div>
      )}
      {activity && <div className="bg-white border border-zm-neutral rounded-xl"><h3 className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-zm-muted">História</h3><ActivityList items={activity} /></div>}
    </Drawer>
  );
}

// Search and pick clients for a deal (or create one on the spot). All clients and the website's contacts are loaded
// once and filtered here as you type: instant, and without diacritics ("jan" finds "Ján").
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Hit = { kind: 'client'; c: Customer } | { kind: 'lead'; l: Lead };

export function CustomerPicker({ value, onChange }: { value: Customer[]; onChange: (c: Customer[]) => void }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<Partial<Customer> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Customer[]>('/api/admin/customers').then(setAll).catch(() => {});
    api<Lead[]>('/api/admin/leads').then(l => setLeads(l.filter(x => !x.customer_id))).catch(() => {});
  }, []);

  const words = norm(q).split(/\s+/).filter(Boolean);
  const match = (fields: (string | null | undefined)[]) => { const t = norm(fields.filter(Boolean).join(' ')); return words.every(w => t.includes(w)); };
  const hits: Hit[] = [
    ...all.filter(c => !value.some(v => v.id === c.id) && match([c.first_name, c.last_name, c.company_name, c.email, c.phone, c.title]))
      .map(c => ({ kind: 'client' as const, c })),
    ...(words.length ? leads.filter(l => match([l.name, l.email, l.phone])).map(l => ({ kind: 'lead' as const, l })) : []),
  ].slice(0, 8);

  const pick = async (h: Hit) => {
    if (h.kind === 'client') onChange([...value, h.c]);
    else {                                    // a website contact becomes a client on the spot
      setBusy(true);
      const parts = (h.l.name || '').trim().split(/\s+/);
      try {
        const c = await api<Customer>('/api/admin/customers', 'POST', { kind: 'person', first_name: parts.slice(0, -1).join(' ') || null, last_name: parts.at(-1) || null, email: h.l.email, phone: h.l.phone, lead_id: h.l.id, source: 'web' });
        setAll([c, ...all]); setLeads(leads.filter(x => x.id !== h.l.id)); onChange([...value, c]);
      } catch {}
      setBusy(false);
    }
    setQ(''); setActive(0);
  };
  const newFromQuery = () => {
    const t = q.trim();
    if (t.includes('@')) return setCreating({ kind: 'person', email: t });
    const parts = t.split(/\s+/);
    setCreating({ kind: 'person', first_name: parts.length > 1 ? parts.slice(0, -1).join(' ') : null, last_name: parts.at(-1) || null });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, hits.length)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (hits[active]) pick(hits[active]); else if (q.trim()) newFromQuery(); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map(c => (
          <span key={c.id} className="inline-flex items-center gap-2 bg-zm-blue/10 text-zm-accent rounded-full pl-3 pr-1 py-1 text-sm">
            {customerName(c)}<button onClick={() => onChange(value.filter(x => x.id !== c.id))} className="w-5 h-5 rounded-full hover:bg-white text-xs">✕</button>
          </span>
        ))}
        {value.length === 0 && <span className="text-sm text-zm-muted">Žiadny klient</span>}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <input placeholder="Meno, email alebo telefón…" value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); }} onKeyDown={onKey} className={inputCls} />
          <button onClick={() => (q.trim() ? newFromQuery() : setCreating({ kind: 'person' }))} className={`${btnSoft} whitespace-nowrap`}>+ Nový</button>
        </div>
        {open && (hits.length > 0 || q.trim()) && (
          <div className="absolute z-20 left-0 right-0 mt-1 border border-zm-neutral rounded-lg bg-white shadow-lg divide-y divide-zm-line max-h-64 overflow-y-auto">
            {hits.map((h, i) => (
              <button key={h.kind === 'client' ? h.c.id : `l${h.l.id}`} onMouseDown={e => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(i)}
                className={`block w-full text-left px-3 py-2 text-sm ${i === active ? 'bg-zm-paper' : ''}`}>
                {h.kind === 'client'
                  ? <>{customerName(h.c)} <span className="text-zm-muted">{[h.c.email, h.c.phone].filter(Boolean).join(' · ')}</span></>
                  : <>{h.l.name} <span className="text-zm-muted">{[h.l.email, h.l.phone].filter(Boolean).join(' · ')}</span> <span className="ml-1 text-[10px] font-bold uppercase bg-zm-orange/30 text-zm-dark rounded px-1.5 py-0.5">kontakt z webu</span></>}
              </button>
            ))}
            {q.trim() && (
              <button onMouseDown={e => e.preventDefault()} onClick={newFromQuery} onMouseEnter={() => setActive(hits.length)}
                className={`block w-full text-left px-3 py-2 text-sm text-zm-blue font-bold ${active === hits.length ? 'bg-zm-paper' : ''}`}>
                + Nový klient „{q.trim()}“
              </button>
            )}
          </div>
        )}
        {busy && <p className="text-xs text-zm-muted mt-1"><Spinner /> Vytváram klienta z kontaktu…</p>}
      </div>
      {creating && <CustomerEditor customer={creating} onClose={() => setCreating(null)} onSaved={c => { setAll([c, ...all]); onChange([...value, c]); setCreating(null); setQ(''); }} />}
    </div>
  );
}
