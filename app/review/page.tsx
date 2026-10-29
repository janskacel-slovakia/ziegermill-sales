'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Logo, Bars, Spinner } from '../admin/_ui/shared';

// Pripomienky k výkresom (19 Oct 2026): the tender floor plans with Jano's numbered points. A number opens the point:
// its picture in 3D, the text, the conversation, the status and a reply (with photos). "Otvoriť v 3D" opens the
// published walkthrough at that spot in a new tab. Jano with his /admin login, the architect with his personal link.

import { Status, Photo, Msg, Point, Page, Me, ST, PLAN_LABEL, GENERAL, when, toPt, who, api } from './shared';

// an important point (29 Oct, Jano: "mark some comments important with exclamation and bolder number and heading"):
// the number heavier, a red "!" beside it, the heading heavier with a red "!" in front
function Num({ p, cls }: { p: Point; cls: string }) {
  return (
    <span className="relative shrink-0 inline-flex">
      <span className={`${cls} rounded-full flex items-center justify-center ${p.important ? 'font-black ring-2 ring-red-600' : 'font-bold'}`} style={{ background: ST[p.status].bg, color: ST[p.status].fg }}>{p.n}</span>
      {p.important && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black leading-none flex items-center justify-center" aria-label="dôležité">!</span>}
    </span>
  );
}
function Title({ p, cls }: { p: Point; cls: string }) {
  return <span className={`${cls} ${p.important ? 'font-black' : ''}`}>{p.important && <span className="text-red-600 mr-1">!</span>}{p.title}</span>;
}

function StatusPill({ s, long }: { s: Status; long?: boolean }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: ST[s].bg, color: ST[s].fg }}>{long ? ST[s].label : ST[s].short}</span>;
}

export default function ReviewPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'nologin' | 'ready'>('loading');
  const [linkErr, setLinkErr] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [plan, setPlan] = useState<string>('');
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [onlyImp, setOnlyImp] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api<{ me: Me; points: Point[]; sheets: { pages: Page[] } }>('/api/review/points');
      setMe(d.me); setPoints(d.points); setPages(d.sheets.pages); setState('ready'); setErr('');
      return d;
    } catch (e: any) {
      if (e.status === 401) setState('nologin'); else setErr(e.message);
      return null;
    }
  }, []);

  // the personal link: /review#k=<token> -> a session, and the token leaves the address bar
  useEffect(() => {
    const start = async () => {
      const k = new URLSearchParams(location.hash.slice(1)).get('k');
      if (k) {
        history.replaceState(null, '', location.pathname + location.search);
        try { await api('/api/review/login', 'POST', { token: k }); } catch (e: any) { setLinkErr(e.message); }
      }
      const d = await load();
      if (!d) return;
      const want = Number(new URLSearchParams(location.search).get('p'));
      const p = d.points.find(x => x.n === want);
      let pl = ''; try { pl = localStorage.getItem('review.plan') || ''; } catch {}
      const plans = new Set([...d.sheets.pages.map(x => x.plan), ...(d.points.some(q => q.plan === GENERAL) ? [GENERAL] : [])]);
      setPlan(p ? p.plan : plans.has(pl) ? pl : (d.sheets.pages.find(x => d.points.some(q => q.plan === x.plan))?.plan || d.sheets.pages[0]?.plan || ''));
      if (p) setSel(p.id);
    };
    start();
    const onHash = () => { if (location.hash.includes('k=')) start(); };   // the link pasted into an open page
    addEventListener('hashchange', onHash); return () => removeEventListener('hashchange', onHash);
  }, [load]);
  useEffect(() => { if (plan) try { localStorage.setItem('review.plan', plan); } catch {} }, [plan]);
  useEffect(() => {                                     // new replies while the page stays open
    if (state !== 'ready') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, [state, load]);

  const page = pages.find(p => p.plan === plan) || null;
  const shown = useMemo(() => points.filter(p => (filter === 'all' || p.status === filter) && (!onlyImp || p.important)), [points, filter, onlyImp]);
  const point = points.find(p => p.id === sel) || null;
  const counts = useMemo(() => {
    const c: Record<string, { all: number; open: number }> = {};
    for (const p of points) { c[p.plan] ??= { all: 0, open: 0 }; c[p.plan].all++; if (p.status === 'open') c[p.plan].open++; }
    return c;
  }, [points]);
  const pick = (p: Point) => { setPlan(p.plan); setSel(p.id); history.replaceState(null, '', `?p=${p.n}`); };
  const close = () => { setSel(null); history.replaceState(null, '', location.pathname); };

  if (state === 'loading') return <div className="min-h-screen bg-zm-blue flex items-center justify-center"><Logo className="h-14 opacity-80" /></div>;
  if (state === 'nologin') return (
    <div className="min-h-screen bg-zm-blue flex flex-col items-center justify-center p-4 gap-6">
      <Logo className="h-12" />
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-bold text-zm-dark">Pripomienky k výkresom</h1>
        {linkErr && <p className="text-sm text-red-700">{linkErr}</p>}
        <p className="text-sm text-zm-muted">Stránku otvoríte osobným odkazom, ktorý ste dostali od Jana Skácela. Ak nefunguje, požiadajte ho o nový.</p>
        <a href="/admin" className="inline-block text-xs text-zm-blue hover:underline">Prihlásenie administrátora</a>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <header className="bg-zm-dark px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0 z-20">
        <Logo className="h-7" />
        <h1 className="text-white font-bold text-sm sm:text-base">Pripomienky k výkresom</h1>
        <div className="flex flex-wrap gap-1">
          {(['all', 'open', 'answered', 'agreed', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${filter === f ? 'bg-zm-orange text-zm-ink' : 'text-zm-neutral hover:bg-white/10'}`}>
              {f === 'all' ? `Všetky ${points.length}` : `${ST[f].short} ${points.filter(p => p.status === f).length}`}
            </button>
          ))}
          {points.some(p => p.important) && (
            <button onClick={() => setOnlyImp(v => !v)} title="Len dôležité pripomienky"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${onlyImp ? 'bg-red-600 text-white' : 'text-zm-neutral hover:bg-white/10'}`}>
              ! Dôležité {points.filter(p => p.important).length}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <a href="/review/print" target="_blank" rel="noopener" title="Všetky výkresy s pripomienkami, obrázkami a odpoveďami ako PDF (v dialógu tlače zvoľte Uložiť ako PDF)"
            className="px-3 py-1.5 rounded-lg bg-zm-orange text-zm-ink text-xs font-bold uppercase tracking-wider hover:bg-white">Export PDF</a>
          <span className="text-white">{me?.display_name} <span className="text-zm-neutral">({me?.role === 'architect' ? 'architekt' : 'investor'})</span></span>
          {me?.role === 'architect' && <button onClick={async () => { await fetch('/api/review/logout', { method: 'POST' }); location.reload(); }} className="text-xs text-zm-neutral hover:text-zm-orange uppercase tracking-wider font-bold">Odhlásiť</button>}
        </div>
      </header>
      <nav className="bg-white border-b border-zm-line px-2 sm:px-4 py-1.5 flex gap-1 overflow-x-auto shrink-0 z-10" aria-label="Pôdorysy">
        {pages.map(p => (
          <button key={p.plan} onClick={() => setPlan(p.plan)} title={p.name}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${plan === p.plan ? 'bg-zm-blue text-white' : 'text-zm-dark hover:bg-zm-paper'} ${counts[p.plan] ? '' : 'opacity-50'}`}>
            {PLAN_LABEL(p.plan)}{counts[p.plan] && <span className={`ml-1.5 px-1.5 rounded-full text-[10px] ${counts[p.plan].open ? 'bg-zm-orange text-zm-ink' : 'bg-zm-neutral text-zm-dark'}`}>{counts[p.plan].all}</span>}
          </button>
        ))}
        {counts[GENERAL] && (
          <button onClick={() => setPlan(GENERAL)} title="Pripomienky bez miesta vo výkrese"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${plan === GENERAL ? 'bg-zm-blue text-white' : 'text-zm-dark hover:bg-zm-paper'}`}>
            Všeobecné<span className={`ml-1.5 px-1.5 rounded-full text-[10px] ${counts[GENERAL].open ? 'bg-zm-orange text-zm-ink' : 'bg-zm-neutral text-zm-dark'}`}>{counts[GENERAL].all}</span>
          </button>
        )}
      </nav>
      {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2">{err}</div>}
      <Bars className="shrink-0" />
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 relative">
          {plan === GENERAL ? <General points={shown.filter(p => p.plan === GENERAL)} sel={sel} onPick={pick} /> :
            page ? <Sheet page={page} points={shown.filter(p => p.plan === page.plan)} sel={sel} onPick={pick} /> :
            <p className="p-6 text-sm text-zm-muted">Pôdorysy sa ešte nenahrali.</p>}
        </div>
        <aside className={`bg-white border-l border-zm-line flex flex-col min-h-0 lg:static lg:w-[26rem] xl:w-[30rem] lg:translate-x-0
            absolute inset-y-0 right-0 w-full md:w-[28rem] z-20 shadow-xl lg:shadow-none transition-transform ${point ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          {point ? <Detail key={point.id} p={point} me={me!} onClose={close} reload={load} /> :
            <List points={shown.filter(p => plan === GENERAL ? p.plan === GENERAL : (!page || p.plan === page.plan))} all={shown}
              label={plan === GENERAL ? 'Všeobecné pripomienky' : page ? page.name : 'Pripomienky'} onPick={pick} />}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the sheet: fit to width, zoom with the buttons, Ctrl+wheel or two fingers
function Sheet({ page, points, sel, onPick }: { page: Page; points: Point[]; sel: string | null; onPick: (p: Point) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const touches = useRef(new Map<number, { x: number; y: number }>()); const pinch = useRef<{ d: number; z: number } | null>(null);
  useEffect(() => { setZoom(1); }, [page.plan]);
  const zoomAt = (z: number, cx?: number, cy?: number) => {
    const el = box.current; if (!el) return;
    const nz = Math.min(8, Math.max(1, z)); const r = el.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
    const fx = (el.scrollLeft + px) / el.scrollWidth, fy = (el.scrollTop + py) / el.scrollHeight;
    setZoom(nz);
    requestAnimationFrame(() => { el.scrollLeft = fx * el.scrollWidth - px; el.scrollTop = fy * el.scrollHeight - py; });
  };
  useEffect(() => {                                   // a chosen point comes into view
    const el = box.current, p = points.find(q => q.id === sel); if (!el || !p) return;
    const [x, y] = toPt(page, p.at);
    requestAnimationFrame(() => {
      el.scrollLeft = (x / page.w) * el.scrollWidth - el.clientWidth / 2; el.scrollTop = (y / page.h) * el.scrollHeight - el.clientHeight / 2;
    });
  }, [sel, page, points, zoom]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  });
  const down = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) { const [a, b] = [...touches.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; }
  };
  const move = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      zoomAt(pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  };
  const up = (e: React.PointerEvent) => { touches.current.delete(e.pointerId); if (touches.current.size < 2) pinch.current = null; };

  return (
    <div className="absolute inset-0">
      <div ref={box} className="absolute inset-0 overflow-auto bg-white" style={{ touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="relative" style={{ width: `${zoom * 100}%`, aspectRatio: `${page.px[0]} / ${page.px[1]}` }}>
          {page.url && <img src={page.url} alt={page.name} className="absolute inset-0 w-full h-full select-none" draggable={false} />}
          {points.map(p => {
            const [x, y] = toPt(page, p.at); const on = p.id === sel;
            return (
              <button key={p.id} onClick={() => onPick(p)} title={`${p.n}. ${p.title}`} aria-label={`Pripomienka ${p.n}: ${p.title}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full font-bold flex items-center justify-center border-2 shadow-md transition-transform
                  ${on ? 'w-10 h-10 text-base scale-110 border-zm-ink z-10' : p.important ? 'w-9 h-9 text-sm border-red-600 hover:scale-110' : 'w-8 h-8 text-sm border-white hover:scale-110'} ${p.important ? 'font-black' : ''}`}
                style={{ left: `${(x / page.w) * 100}%`, top: `${(y / page.h) * 100}%`, background: ST[p.status].bg, color: ST[p.status].fg }}>
                {p.n}
                {p.important && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black leading-none flex items-center justify-center">!</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="absolute left-3 bottom-3 flex flex-col gap-1 z-10">
        <button onClick={() => zoomAt(zoom * 1.4)} className="w-9 h-9 rounded-lg bg-zm-dark text-white text-lg font-bold shadow" aria-label="Priblížiť">+</button>
        <button onClick={() => zoomAt(zoom / 1.4)} className="w-9 h-9 rounded-lg bg-zm-dark text-white text-lg font-bold shadow" aria-label="Oddialiť">−</button>
        <button onClick={() => zoomAt(1)} className="w-9 h-9 rounded-lg bg-zm-neutral text-zm-dark text-[10px] font-bold shadow" aria-label="Celý výkres">celý</button>
      </div>
      <div className="absolute right-3 bottom-3 bg-white/90 rounded-lg px-3 py-2 text-[11px] text-zm-dark shadow z-10 space-y-0.5 hidden sm:block">
        {(Object.keys(ST) as Status[]).map(s => <div key={s} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: ST[s].bg }} />{ST[s].label}</div>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- notes without a place on a drawing: cards instead of a sheet
function General({ points, sel, onPick }: { points: Point[]; sel: string | null; onPick: (p: Point) => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-zm-paper p-3 sm:p-5">
      <h2 className="text-sm font-bold text-zm-dark mb-3">Všeobecné pripomienky <span className="font-normal text-zm-muted">– bez miesta vo výkrese</span></h2>
      <div className="grid gap-3 md:grid-cols-2">
        {points.map(p => (
          <button key={p.id} onClick={() => onPick(p)}
            className={`text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${p.id === sel ? 'border-zm-ink shadow-md' : 'border-zm-line'}`}>
            <div className="flex items-start gap-3">
              <Num p={p} cls="w-8 h-8 text-sm" />
              <span className="min-w-0">
                <Title p={p} cls="block font-bold text-zm-ink leading-snug" />
                <span className="block text-sm text-zm-muted mt-1 line-clamp-3 whitespace-pre-wrap">{p.text}</span>
                <span className="block text-[11px] text-zm-muted mt-2">{ST[p.status].short}{p.unit ? ` · ${p.unit}` : ''}{p.messages.length ? ` · ${p.messages.length} ${p.messages.length === 1 ? 'odpoveď' : p.messages.length < 5 ? 'odpovede' : 'odpovedí'}` : ''}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the list of the sheet's points (no point open)
function List({ points, all, label, onPick }: { points: Point[]; all: Point[]; label: string; onPick: (p: Point) => void }) {
  const Row = ({ p }: { p: Point }) => (
    <li>
      <button onClick={() => onPick(p)} className="w-full text-left px-4 py-3 hover:bg-zm-paper flex gap-3 items-start">
        <Num p={p} cls="w-7 h-7 text-xs" />
        <span className="min-w-0">
          <Title p={p} cls="block text-sm font-medium text-zm-ink leading-snug" />
          <span className="block text-[11px] text-zm-muted mt-0.5">{[p.unit, PLAN_LABEL(p.plan)].filter(Boolean).join(' · ')}{p.messages.length ? ` · ${p.messages.length} ${p.messages.length === 1 ? 'odpoveď' : p.messages.length < 5 ? 'odpovede' : 'odpovedí'}` : ''}</span>
        </span>
      </button>
    </li>
  );
  const rest = all.filter(p => !points.includes(p));
  return (
    <div className="flex-1 overflow-y-auto">
      <p className="px-4 pt-4 pb-2 text-xs text-zm-muted">Kliknite na číslo vo výkrese alebo v zozname. Pri každej pripomienke je pohľad v 3D a tlačidlo, ktoré otvorí 3D model presne na tom mieste.</p>
      <h2 className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-zm-dark">{label} ({points.length})</h2>
      <ul className="divide-y divide-zm-line">{points.map(p => <Row key={p.id} p={p} />)}</ul>
      {rest.length > 0 && <>
        <h2 className="px-4 pt-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-zm-dark">Ostatné výkresy ({rest.length})</h2>
        <ul className="divide-y divide-zm-line">{rest.map(p => <Row key={p.id} p={p} />)}</ul>
      </>}
    </div>
  );
}

// ---------------------------------------------------------------- one point: picture, text, thread, reply
function Detail({ p, me, onClose, reload }: { p: Point; me: Me; onClose: () => void; reload: () => Promise<unknown> }) {
  const arch = me.role === 'architect';
  const draftKey = `review.draft.${p.id}`;
  const [text, setText] = useState(() => { try { return localStorage.getItem(draftKey) || ''; } catch { return ''; } });
  const [photos, setPhotos] = useState<(Photo & { preview: string })[]>([]);
  const [status, setStatus] = useState<Status>(arch ? 'answered' : 'open');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [big, setBig] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { if (text) localStorage.setItem(draftKey, text); else localStorage.removeItem(draftKey); } catch {} }, [text, draftKey]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [p.messages.length]);

  const add = async (files: File[]) => {
    setErr('');
    for (const f of files.slice(0, 8)) {
      if (!/^image\//.test(f.type) && f.type !== 'application/pdf') { setErr('Len obrázky alebo PDF'); continue; }
      setBusy('Nahrávam foto…');
      try {
        const name = f.name && f.name !== 'image.png' ? f.name : `foto_${Date.now()}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
        const { path, token } = await api<{ path: string; token: string }>('/api/review/files', 'POST', { point_id: p.id, file_name: name });
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
        const { error } = await sb.storage.from('review').uploadToSignedUrl(path, token, f, { contentType: f.type || undefined });
        if (error) throw new Error(`Nahrávanie zlyhalo: ${error.message}`);
        const preview = URL.createObjectURL(f);
        const dim = f.type.startsWith('image/') ? await new Promise<{ w: number; h: number }>(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => r({ w: 0, h: 0 }); i.src = preview; }) : { w: 0, h: 0 };
        setPhotos(ph => [...ph, { path, name, ...dim, preview }]);
      } catch (e: any) { setErr(e.message); }
    }
    setBusy('');
  };
  const paste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) { e.preventDefault(); add(files); }
  };
  const send = async () => {
    if (!text.trim() && !photos.length) return;
    setBusy('Odosielam…'); setErr('');
    try {
      await api(`/api/review/points/${p.id}/messages`, 'POST', { text, status, photos: photos.map(({ preview, ...f }) => f) });
      setText(''); setPhotos([]); try { localStorage.removeItem(draftKey); } catch {}
      await reload();
    } catch (e: any) { setErr(e.message); }
    setBusy('');
  };
  const setOnly = async (s: Status) => {
    setBusy('Ukladám…'); setErr('');
    try { await api(`/api/review/points/${p.id}`, 'PATCH', { status: s }); await reload(); } catch (e: any) { setErr(e.message); }
    setBusy('');
  };
  const choices: Status[] = arch ? ['answered', 'agreed'] : ['open', 'agreed', 'done'];

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-4 py-3 border-b border-zm-line flex items-start gap-3 shrink-0">
        <Num p={p} cls="w-9 h-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><StatusPill s={p.status} long /><span className="text-[11px] text-zm-muted">{[p.unit, PLAN_LABEL(p.plan), p.page ? `výkres str. ${p.page}` : ''].filter(Boolean).join(' · ')}</span></div>
          <h2 className="mt-1 text-zm-ink leading-snug"><Title p={p} cls="font-bold" /></h2>
        </div>
        <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg hover:bg-zm-paper text-zm-dark text-xl leading-none" aria-label="Zavrieť">×</button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {p.still?.url && (                               // the picture only enlarges; 3D opens from the one button below (Jano, 28 Oct)
          <button onClick={() => setBig(p.still!.url!)} className="block w-full relative bg-zm-dark cursor-zoom-in" title="Zväčšiť">
            <img src={p.still.url} alt={`Pohľad v 3D – pripomienka ${p.n}`} className="w-full block" />
            {p.still.pin && p.still.pin[0] > 0.02 && p.still.pin[0] < 0.98 && p.still.pin[1] > 0.02 && p.still.pin[1] < 0.98 && (
              <span className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white font-bold text-sm flex items-center justify-center shadow-lg"
                style={{ left: `${p.still.pin[0] * 100}%`, top: `${p.still.pin[1] * 100}%`, background: ST[p.status].bg, color: ST[p.status].fg }}>{p.n}</span>
            )}
          </button>
        )}
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2 items-center">
          {p.view?.kind === 'none'                           // the spot is in none of the 3D models (e.g. most of the ground floor)
            ? <span className="text-[11px] text-zm-muted">Toto miesto zatiaľ nie je v 3D modeli.</span>
            : <a href={p.walk_url} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-zm-orange text-zm-ink text-xs font-bold hover:bg-zm-dark hover:text-white">
                {p.view?.kind === 'exterior' ? '3D model budovy ↗' : 'Otvoriť v 3D na tomto mieste ↗'}</a>}
          {p.view?.kind === 'exterior' && <span className="text-[11px] text-zm-muted">(exteriér: výber budovy, pohľad nastavte myšou)</span>}
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-zm-muted mb-1">Jano Skácel{p.date ? ` · ${new Date(p.date).toLocaleDateString('sk-SK')}` : ''}</div>
          <p className="text-sm text-zm-ink whitespace-pre-wrap leading-relaxed">{p.text}</p>
        </div>

        {p.messages.length > 0 && (
          <ol className="px-4 pb-2 space-y-3">
            {p.messages.map(m => (
              <li key={m.id} className={`rounded-xl px-3 py-2 ${m.by === 'architect' ? 'bg-zm-blue/10 ml-6' : 'bg-zm-paper mr-6'}`}>
                <div className="text-[11px] text-zm-muted mb-0.5"><b className="text-zm-dark">{who(m)}</b> · {when(m.created_at)}</div>
                {m.text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                {m.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.photos.map(f => f.url && (/\.pdf$/i.test(f.path)
                      ? <a key={f.path} href={f.url} target="_blank" rel="noopener" className="text-xs text-zm-blue underline">{f.name || 'PDF'}</a>
                      : <button key={f.path} onClick={() => setBig(f.url!)}><img src={f.url} alt={f.name} className="h-20 rounded-lg border border-zm-line object-cover" /></button>))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
        {p.status_by && <p className="px-4 pb-3 text-[11px] text-zm-muted">Stav nastavil {p.status_by === 'studio' ? 'Jano Skácel (Studio)' : p.status_by} · {when(p.status_at)}</p>}
      </div>

      <div className="border-t border-zm-line p-3 space-y-2 shrink-0 bg-white">
        <textarea value={text} onChange={e => setText(e.target.value)} onPaste={paste} rows={3}
          placeholder={arch ? 'Vaša odpoveď… (fotku vložíte aj cez Ctrl+V)' : 'Odpoveď architektovi…'}
          className="w-full px-3 py-2 bg-white text-zm-ink placeholder:text-zm-muted/70 border border-zm-neutral rounded-lg text-sm focus:ring-2 focus:ring-zm-blue focus:border-transparent outline-none resize-y" />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map(f => (
              <span key={f.path} className="relative">
                {f.w ? <img src={f.preview} alt={f.name} className="h-14 rounded border border-zm-line" /> : <span className="text-xs px-2 py-1 bg-zm-paper rounded">{f.name}</span>}
                <button onClick={() => setPhotos(ph => ph.filter(x => x.path !== f.path))} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zm-dark text-white text-xs leading-none" aria-label="Odobrať">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg bg-zm-neutral/50 text-zm-dark text-xs font-bold cursor-pointer hover:bg-zm-neutral">
            + Foto<input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => { add([...(e.target.files || [])]); e.target.value = ''; }} />
          </label>
          <select value={status} onChange={e => setStatus(e.target.value as Status)} className="px-2 py-1.5 border border-zm-neutral rounded-lg text-xs bg-white text-zm-ink" aria-label="Stav po odoslaní">
            {choices.map(s => <option key={s} value={s}>Stav: {ST[s].short}</option>)}
          </select>
          <button onClick={send} disabled={!!busy || (!text.trim() && !photos.length)} className="ml-auto px-4 py-1.5 rounded-lg bg-zm-blue text-white text-xs font-bold hover:bg-zm-accent disabled:opacity-50">Odoslať</button>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-zm-muted">
          <span>Len zmeniť stav:</span>
          {choices.filter(s => s !== p.status).map(s => <button key={s} onClick={() => setOnly(s)} disabled={!!busy} className="px-2 py-0.5 rounded-full border border-zm-neutral hover:bg-zm-paper text-zm-dark">{ST[s].short}</button>)}
        </div>
        {busy && <p className="text-xs text-zm-muted flex items-center gap-2"><Spinner />{busy}</p>}
        {err && <p className="text-xs text-red-700">{err}</p>}
      </div>
      {big && <button className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setBig(null)} aria-label="Zavrieť"><img src={big} alt="" className="max-w-full max-h-full rounded" /></button>}
    </div>
  );
}
