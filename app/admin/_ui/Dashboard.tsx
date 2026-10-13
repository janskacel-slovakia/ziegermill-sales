'use client';

import React, { useEffect, useState } from 'react';
import { User, api, eur, Card, Field, inputCls, btnPrimary, btnGrey, ErrorLine, STAGE_LABELS, Stage } from './shared';

type Step = { phase: Stage | 'free'; value: number; units: number; parking: number; discount: number };
type Setting = { key: string; value: any; label: string; admin_only: boolean };
type Data = {
  steps: Step[]; total: number; unpriced_parking: number; discount_total: number;
  offers: { count: number; units: number };
  commission: { rate: number; rate_complex: number; claims_rate: number; base: 'net' | 'gross'; due_stage: Stage; earned: number; pipeline: number; potential: number; claims: number };
  profit?: { vat_rate: number; revenue_gross: number; revenue_net: number; vat: number; commission: number; claims: number; marketing: number;
    costs: number | null; profit: number | null; margin: number | null; contracted_net: number; secured_net: number; break_even_gross: number | null };
  settings: Setting[];
};

const PHASE_NAME: Record<string, string> = { sold: 'Odovzdané', purchase_contract: 'KZ / predané', future_contract: 'ZOBZ', reserved: 'Rezervácie', free: 'Voľné (cenník)' };
// Jano, 9 Oct: the walk goes Voľné → Rezervácie → ZOBZ → KZ / predané → Predpoklad spolu. A signed KZ counts as sold;
// handed-over deals (stage 'sold' = Odovzdané) are added into the KZ bar.
const ORDER = ['free', 'reserved', 'future_contract', 'purchase_contract'];
const PHASE_COLOR: Record<string, string> = { sold: '#544740', purchase_contract: '#04318c', future_contract: '#3091b2', reserved: '#ffa62b', free: '#d6d9c7' };
const pct = (x: number, d = 2) => `${(x * 100).toLocaleString('sk-SK', { maximumFractionDigits: d })} %`;
const mil = (n: number) => `${(n / 1e6).toLocaleString('sk-SK', { maximumFractionDigits: 2 })} mil. €`;

export default function Dashboard({ user }: { user: User }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const load = () => api<Data>('/api/admin/dashboard').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (!d) return <Card><p className="p-6 text-zm-muted">{err || 'Načítavam…'}</p></Card>;
  const handed = d.steps.find(s => s.phase === 'sold');
  const steps = d.steps.filter(s => s.phase !== 'sold').map(s => s.phase === 'purchase_contract' && handed
    ? { ...s, value: s.value + handed.value, units: s.units + handed.units, parking: s.parking + handed.parking, discount: s.discount + handed.discount } : s)
    .sort((a, b) => ORDER.indexOf(a.phase) - ORDER.indexOf(b.phase));

  const soldShare = d.total ? d.steps.filter(s => s.phase !== 'free').reduce((a, s) => a + s.value, 0) / d.total : 0;
  const units = d.steps.reduce((a, s) => a + s.units, 0);
  const c = d.commission;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Predpoklad tržieb (s DPH)" value={mil(d.total)} note={`${units} jednotiek${d.unpriced_parking ? ` · ${d.unpriced_parking} státí bez ceny` : ''}`} />
        <Kpi label="Zazmluvnené + rezervované" value={pct(soldShare, 1)} note={eur(d.total * soldShare)} accent />
        <Kpi label="Jednotky od rezervácie" value={`${d.steps.filter(s => s.phase !== 'free').reduce((a, s) => a + s.units, 0)} / ${units}`} note={`ponuky v riešení: ${d.offers.count}`} />
        <Kpi label="Zľavy oproti cenníku" value={eur(d.discount_total)} note="dohodnuté ceny vs. cenník" />
      </div>

      <Card title="Cesta k predpokladaným tržbám">
        <div className="p-4"><Waterfall steps={steps} total={d.total} /></div>
        <StackBar steps={steps} total={d.total} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-y border-zm-neutral">
              {['Fáza', 'Jednotky', 'Státia', 'Hodnota s DPH', 'Podiel', 'Zľavy'].map(h => <th key={h} className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-zm-dark font-bold">{h}</th>)}
            </tr></thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.phase} className="border-b border-zm-line">
                  <td className="py-2 px-3 flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: PHASE_COLOR[s.phase] }} />{PHASE_NAME[s.phase]}</td>
                  <td className="py-2 px-3">{s.units}</td><td className="py-2 px-3">{s.parking}</td>
                  <td className="py-2 px-3 font-bold">{eur(s.value)}</td><td className="py-2 px-3">{d.total ? pct(s.value / d.total, 1) : '—'}</td>
                  <td className="py-2 px-3 text-zm-muted">{s.discount ? eur(s.discount) : ''}</td>
                </tr>
              ))}
              <tr className="font-bold"><td className="py-2 px-3">Spolu</td><td className="py-2 px-3">{units}</td><td className="py-2 px-3">{d.steps.reduce((a, s) => a + s.parking, 0)}</td><td className="py-2 px-3">{eur(d.total)}</td><td /><td /></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Provízia makléra (${pct(c.rate)} / ${pct(c.rate_complex)} pri komplikovanom prípade, bez DPH)`}>
        <div className="p-4 grid sm:grid-cols-4 gap-3">
          <Kpi label={`Zarobená (od fázy ${STAGE_LABELS[c.due_stage]?.label})`} value={eur(c.earned)} accent />
          <Kpi label="V procese (rezervácie, ZOBZ)" value={eur(c.pipeline)} />
          <Kpi label="Potenciál (voľné)" value={eur(c.potential)} />
          <Kpi label={`Reklamácie ${pct(c.claims_rate)} (celý projekt)`} value={eur(c.claims)} />
        </div>
        <p className="px-4 pb-4 text-xs text-zm-muted">Základ: kúpna cena {c.base === 'net' ? 'bez DPH' : 's DPH'} (jednotka + parkovanie). Spolu pri predaji všetkého: <b className="text-zm-ink">{eur(c.earned + c.pipeline + c.potential)}</b> + reklamácie. Podľa ponuky Nidal „Cenová ponuka – Exkluzívny predaj“.</p>
      </Card>

      {user.role === 'admin' && d.profit && <Profit p={d.profit} />}
      {user.role === 'admin' && <Settings settings={d.settings} onSaved={load} />}
    </div>
  );
}

function Kpi({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-zm-dark text-white border-zm-dark' : 'bg-white border-zm-neutral'}`}>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${accent ? 'text-zm-neutral' : 'text-zm-dark'}`}>{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {note && <div className={`text-xs mt-1 ${accent ? 'text-zm-neutral' : 'text-zm-muted'}`}>{note}</div>}
    </div>
  );
}

// From 0 through each phase to the forecast total; each bar floats from the running sum.
function Waterfall({ steps, total }: { steps: Step[]; total: number }) {
  const W = 900, H = 320, top = 30, bottom = 50, left = 70, gap = 22;
  const bars = [...steps.map(s => ({ name: PHASE_NAME[s.phase], value: s.value, color: PHASE_COLOR[s.phase], sub: `${s.units} j.` })), { name: 'Predpoklad spolu', value: total, color: '#231f20', sub: '', total: true } as any];
  const bw = (W - left - gap * (bars.length + 1)) / bars.length;
  const max = total || 1;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  let run = 0;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {ticks.map(t => (
        <g key={t}><line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="#e2e4d8" /><text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#6b5e55">{(t / 1e6).toLocaleString('sk-SK', { maximumFractionDigits: 1 })} M</text></g>
      ))}
      {bars.map((b, i) => {
        const x = left + gap + i * (bw + gap);
        const from = b.total ? 0 : run, to = b.total ? b.value : run + b.value;
        if (!b.total) run = to;
        const h = Math.max(y(from) - y(to), b.value ? 2 : 0);
        return (
          <g key={b.name}>
            {i > 0 && !b.total && <line x1={x - gap} x2={x} y1={y(from)} y2={y(from)} stroke="#6b5e55" strokeDasharray="3 3" />}
            <rect x={x} y={y(to)} width={bw} height={h} fill={b.color} rx={3} stroke={b.color === '#d6d9c7' ? '#b9bda7' : 'none'} />
            <text x={x + bw / 2} y={y(to) - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#231f20">{b.value ? `${(b.value / 1e6).toLocaleString('sk-SK', { maximumFractionDigits: 2 })} M` : '0'}</text>
            <text x={x + bw / 2} y={H - bottom + 18} textAnchor="middle" fontSize={12} fill="#231f20">{b.name}</text>
            {b.sub && <text x={x + bw / 2} y={H - bottom + 34} textAnchor="middle" fontSize={11} fill="#6b5e55">{b.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// The same split as one 100 % bar.
function StackBar({ steps, total }: { steps: Step[]; total: number }) {
  return (
    <div className="px-4 pb-4">
      <div className="flex h-6 rounded-md overflow-hidden border border-zm-neutral">
        {steps.filter(s => s.value > 0).map(s => (
          <div key={s.phase} title={`${PHASE_NAME[s.phase]}: ${eur(s.value)}`} style={{ width: `${(s.value / (total || 1)) * 100}%`, background: PHASE_COLOR[s.phase] }} />
        ))}
      </div>
    </div>
  );
}

function Profit({ p }: { p: NonNullable<Data['profit']> }) {
  const line = (label: string, v: number | null, strong = false, minus = true) => (
    <tr className={`border-b border-zm-line ${strong ? 'font-bold' : ''}`}><td className="py-2 px-3">{label}</td><td className="py-2 px-3 text-right whitespace-nowrap">{v == null ? '—' : `${minus && v ? '− ' : ''}${eur(v)}`}</td></tr>
  );
  return (
    <Card title="Ziskovosť projektu (len administrátor)">
      <div className="p-4 grid lg:grid-cols-2 gap-4">
        <table className="w-full text-sm bg-white">
          <tbody>
            {line('Tržby s DPH (predpoklad)', p.revenue_gross, true, false)}
            {line(`DPH ${pct(p.vat_rate, 0)}`, p.vat)}
            {line('Tržby bez DPH', p.revenue_net, true, false)}
            {line('Náklady projektu', p.costs)}
            {line('Provízia makléra', p.commission)}
            {line('Reklamácie (maklér)', p.claims)}
            {line('Marketing', p.marketing)}
            <tr className="font-bold text-lg"><td className="py-2 px-3">Zisk pred zdanením</td><td className="py-2 px-3 text-right">{p.profit == null ? '—' : eur(p.profit)}</td></tr>
          </tbody>
        </table>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Marža (zo tržieb bez DPH)" value={p.margin == null ? '—' : pct(p.margin, 1)} accent />
            <Kpi label="Zazmluvnené (KZ + predané) bez DPH" value={eur(p.contracted_net)} />
            <Kpi label="Zabezpečené (od rezervácie) bez DPH" value={eur(p.secured_net)} />
            <Kpi label="Na pokrytie nákladov treba ešte predať (s DPH)" value={p.break_even_gross == null ? '—' : eur(p.break_even_gross)} />
          </div>
          {p.costs == null && <p className="text-sm text-zm-dark bg-zm-orange/20 border border-zm-orange rounded-lg p-3">Náklady zatiaľ nie sú zadané. Kým nebude rozpočet nákladov, zadajte odhad v Nastaveniach nižšie; potom sa sem budú načítavať z rozpočtu.</p>}
        </div>
      </div>
    </Card>
  );
}

const PERCENT = ['commission_rate', 'commission_rate_complex', 'claims_rate', 'vat_rate'];
function Settings({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(settings.map(s => [s.key, s.value == null ? '' : PERCENT.includes(s.key) ? String(+(s.value * 100).toFixed(4)) : String(s.value)])));
  const [err, setErr] = useState(''); const [open, setOpen] = useState(false);
  const save = async () => {
    setErr('');
    const body: Record<string, unknown> = {};
    for (const s of settings) {
      const raw = v[s.key];
      let val: unknown = raw === '' ? null : raw;
      if (PERCENT.includes(s.key)) val = raw === '' ? null : Number(raw.replace(',', '.')) / 100;
      else if (['marketing_monthly', 'marketing_months', 'costs_total'].includes(s.key)) val = raw === '' ? null : Number(raw.replace(/\s/g, '').replace(',', '.'));
      if (JSON.stringify(val) !== JSON.stringify(s.value)) body[s.key] = val;
    }
    try { if (Object.keys(body).length) await api('/api/admin/dashboard', 'PATCH', body); onSaved(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Card title="Nastavenia výpočtov (len administrátor)" actions={<button onClick={() => setOpen(!open)} className={btnGrey}>{open ? 'Skryť' : 'Upraviť'}</button>}>
      {open && (
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {settings.map(s => (
            <Field key={s.key} label={`${s.label}${PERCENT.includes(s.key) ? ' (%)' : ''}`}>
              {s.key === 'commission_base' ? (
                <select className={inputCls} value={v[s.key]} onChange={e => setV({ ...v, [s.key]: e.target.value })}><option value="gross">s DPH</option><option value="net">bez DPH</option></select>
              ) : s.key === 'commission_due_stage' ? (
                <select className={inputCls} value={v[s.key]} onChange={e => setV({ ...v, [s.key]: e.target.value })}>
                  {['reserved', 'future_contract', 'purchase_contract', 'sold'].map(k => <option key={k} value={k}>{STAGE_LABELS[k as Stage].label}</option>)}
                </select>
              ) : <input className={inputCls} value={v[s.key]} onChange={e => setV({ ...v, [s.key]: e.target.value })} />}
            </Field>
          ))}
          <div className="sm:col-span-2 lg:col-span-3"><ErrorLine error={err} /><button onClick={save} className={btnPrimary}>Uložiť</button></div>
        </div>
      )}
    </Card>
  );
}

