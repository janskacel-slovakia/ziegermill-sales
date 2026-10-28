'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Logo } from '../../admin/_ui/shared';
import { Point, Page, Me, ST, PLAN_LABEL, when, toPt, who, api } from '../shared';

// The review as a PDF (28 Oct 2026, Jano: "export button, so architect can export everything to PDF - the floorplans with
// notes and his answers"): a print view, A3 landscape. Per sheet with points: the plan with the numbered points in their
// status colours, then each point - its 3D picture, the text, every reply with its photos, the status. It opens the print
// dialog once every picture is loaded; "Uložiť ako PDF" there gives the file (any browser, also on the iPad).
export default function ReviewPrint() {
  const [data, setData] = useState<{ me: Me; points: Point[]; sheets: { pages: Page[] } } | null>(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const printed = useRef(false);

  useEffect(() => { api('/api/review/points').then(setData).catch(e => setErr(e.status === 401 ? 'Najprv otvorte stránku pripomienok svojím odkazom.' : e.message)); }, []);
  useEffect(() => {                                     // every picture loaded (or failed) -> the print dialog, once
    if (!data) return;
    const imgs = [...document.images];
    Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })))
      .then(() => { setReady(true); if (!printed.current && !location.search.includes('noprint')) { printed.current = true; setTimeout(() => window.print(), 400); } });
  }, [data]);

  if (err) return <p className="p-8 text-red-700">{err}</p>;
  if (!data) return <p className="p-8 text-zm-muted">Pripravujem PDF…</p>;
  const sheets = data.sheets.pages.filter(pg => data.points.some(p => p.plan === pg.plan));
  const today = new Date().toLocaleDateString('sk-SK');
  const counts = (Object.keys(ST) as (keyof typeof ST)[]).map(s => [s, data.points.filter(p => p.status === s).length] as const);

  return (
    <div className="zm-print bg-white text-zm-ink">
      <style>{`
        @page { size: A3 landscape; margin: 10mm; }
        @media print { .noprint { display: none !important; } body, .zm-print { background: #fff !important; } }
        .zm-print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet { break-after: page; }
        .pt { break-inside: avoid; }
      `}</style>
      <div className="noprint sticky top-0 z-10 bg-zm-dark text-white px-4 py-2 flex items-center gap-3 text-sm">
        <span>{ready ? 'V dialógu tlače zvoľte „Uložiť ako PDF“ (A3 na šírku).' : 'Načítavam výkresy a obrázky…'}</span>
        <button onClick={() => window.print()} disabled={!ready} className="ml-auto px-3 py-1.5 rounded-lg bg-zm-orange text-zm-ink text-xs font-bold disabled:opacity-50">Uložiť ako PDF</button>
      </div>

      <section className="sheet px-2 pt-2">
        <div className="flex items-center gap-4 bg-zm-dark rounded-lg px-5 py-4"><Logo className="h-10" />
          <div className="text-white"><div className="text-xl font-bold">Pripomienky k výkresom – tendrová dokumentácia</div>
            <div className="text-sm text-zm-neutral">Rekonštrukcia a dostavba budovy bývalej smaltovne Matador · stav k {today} · {data.points.length} pripomienok</div></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {counts.map(([s, c]) => <span key={s} className="flex items-center gap-2"><i className="w-3 h-3 rounded-full inline-block" style={{ background: ST[s].bg }} />{ST[s].label}: <b>{c}</b></span>)}
        </div>
        <table className="mt-4 w-full text-sm border-collapse">
          <thead><tr className="text-left border-b-2 border-zm-dark"><th className="py-1 pr-2">Č.</th><th className="pr-2">Výkres</th><th className="pr-2">Jednotka</th><th className="pr-2">Pripomienka</th><th className="pr-2">Stav</th><th>Odpovede</th></tr></thead>
          <tbody>{data.points.map(p => (
            <tr key={p.id} className="border-b border-zm-line align-top">
              <td className="py-1 pr-2 font-bold">{p.n}</td><td className="pr-2 whitespace-nowrap">{PLAN_LABEL(p.plan)}</td><td className="pr-2">{p.unit}</td>
              <td className="pr-2">{p.title}</td><td className="pr-2 whitespace-nowrap">{ST[p.status].short}</td><td>{p.messages.length || ''}</td>
            </tr>))}</tbody>
        </table>
      </section>

      {sheets.map(pg => {
        const pts = data.points.filter(p => p.plan === pg.plan);
        const ratio = pg.px[0] / pg.px[1];
        return (
          <React.Fragment key={pg.plan}>
            <section className="sheet px-2 pt-2">
              <h2 className="text-lg font-bold text-zm-dark mb-2">{pg.name} <span className="text-zm-muted font-normal">· výkres str. {pg.page} · {pts.length} {pts.length === 1 ? 'pripomienka' : pts.length < 5 ? 'pripomienky' : 'pripomienok'}</span></h2>
              <div className="relative border border-zm-line mx-auto" style={{ width: `min(100%, ${(255 * ratio).toFixed(0)}mm)`, aspectRatio: `${pg.px[0]} / ${pg.px[1]}` }}>
                {pg.url && <img src={pg.url} alt={pg.name} className="absolute inset-0 w-full h-full" />}
                {pts.map(p => { const [x, y] = toPt(pg, p.at); return (
                  <span key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white font-bold text-xs flex items-center justify-center shadow"
                    style={{ left: `${(x / pg.w) * 100}%`, top: `${(y / pg.h) * 100}%`, background: ST[p.status].bg, color: ST[p.status].fg }}>{p.n}</span>); })}
              </div>
            </section>
            <section className="sheet px-2 pt-2 columns-2 gap-6">
              {pts.map(p => (
                <article key={p.id} className="pt mb-5 border border-zm-line rounded-lg overflow-hidden">
                  <div className="flex items-start gap-3 px-3 py-2 bg-zm-paper">
                    <span className="w-8 h-8 shrink-0 rounded-full font-bold flex items-center justify-center" style={{ background: ST[p.status].bg, color: ST[p.status].fg }}>{p.n}</span>
                    <div><div className="font-bold leading-snug">{p.title}</div>
                      <div className="text-xs text-zm-muted">{p.unit} · {PLAN_LABEL(p.plan)} · stav: {ST[p.status].label}{p.status_by ? ` (${p.status_by === 'studio' ? 'Jano Skácel' : p.status_by}, ${when(p.status_at)})` : ''}</div></div>
                  </div>
                  {p.still?.url && <img src={p.still.url} alt="" className="w-full block" style={{ maxHeight: '95mm', objectFit: 'cover' }} />}
                  <div className="px-3 py-2 text-sm">
                    <div className="text-xs text-zm-muted">Jano Skácel{p.date ? ` · ${new Date(p.date).toLocaleDateString('sk-SK')}` : ''}</div>
                    <p className="whitespace-pre-wrap">{p.text}</p>
                    {p.messages.map(m => (
                      <div key={m.id} className={`mt-2 rounded px-2 py-1 ${m.by === 'architect' ? 'bg-zm-blue/10' : 'bg-zm-paper'}`}>
                        <div className="text-xs text-zm-muted"><b className="text-zm-dark">{who(m)}</b> · {when(m.created_at)}</div>
                        {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                        {m.photos.some(f => f.url && !/\.pdf$/i.test(f.path)) && <div className="mt-1 flex flex-wrap gap-2">
                          {m.photos.filter(f => f.url && !/\.pdf$/i.test(f.path)).map(f => <img key={f.path} src={f.url!} alt={f.name} style={{ maxHeight: '45mm', maxWidth: '100%' }} />)}</div>}
                        {m.photos.filter(f => /\.pdf$/i.test(f.path)).map(f => <div key={f.path} className="text-xs">Príloha: {f.name}</div>)}
                      </div>
                    ))}
                    {!p.messages.length && <p className="mt-2 text-xs text-zm-muted">Bez odpovede.</p>}
                  </div>
                </article>
              ))}
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
}
