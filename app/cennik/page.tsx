'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const avenirBody = "font-['Avenir_Light',_'Avenir',_'Avenir_Next',_'Helvetica_Neue',_Arial,_sans-serif] font-light";
const avenirHeading = "font-['Avenir_Black',_'Avenir',_'Avenir_Next',_'Helvetica_Neue',_Arial,_sans-serif] font-black";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
type FlatStatus = 'available' | 'reserved' | 'sold' | 'unavailable';
interface Unit {
  id: string; name: string; unit_type: string; floor_number: number; rooms: string;
  interior_area: number; exterior_area: number; exterior_type: string; orientation: string;
  price: number; price_per_m2: number; status: FlatStatus;
}
interface Floor { id: number; label: string; type: string; flats: Unit[]; }

// ═══════════════════════════════════════════════════════════════
// ZONE COORDINATES
// Building zones (from mapper tool)
// ═══════════════════════════════════════════════════════════════
const FLOOR_ZONES: Record<number, string> = {
  6: "39,140 203,17 516,227 516,298 204,151 39,240",
  5: "39,240 205,152 515,299 516,356 204,258 40,313",
  4: "39,313 203,258 515,355 516,406 203,347 39,381",
  3: "39,382 203,348 519,406 519,438 203,409 39,426",
  2: "39,426 203,409 512,438 511,470 204,463 40,468",
};

// Floor plan flat zones — POLYGON points per flat (from mapper-floor tool)
// Use /mapper-floor to generate these from your floor plan PNGs
// The viewBox for each floor plan matches the PNG's natural dimensions
const FLAT_PLAN_ZONES: Record<string, string> = {
  "2A": "50,50 400,50 400,350 50,350",
  "2B": "420,50 780,50 780,350 420,350",
  "3A": "50,50 400,50 400,350 50,350",
  "3B": "420,50 780,50 780,350 420,350",
  "4A": "50,50 400,50 400,350 50,350",
  "4B": "420,50 780,50 780,350 420,350",
  "5A": "50,50 270,50 270,350 50,350",
  "5B": "290,50 510,50 510,350 290,350",
  "5C": "530,50 780,50 780,350 530,350",
  "6A": "50,50 400,50 400,350 50,350",
  "6B": "420,50 780,50 780,350 420,350",
};

// ViewBox dimensions per floor plan image (set to match your PNG pixel dimensions)
// Update these after you export your floor plan PNGs
const FLOOR_PLAN_VB: Record<number, { w: number; h: number }> = {
  2: { w: 800, h: 400 },
  3: { w: 800, h: 400 },
  4: { w: 800, h: 400 },
  5: { w: 800, h: 400 },
  6: { w: 800, h: 400 },
};

const ST: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "Voľný", color: "#2a9d5c", bg: "rgba(42,157,92,0.08)" },
  reserved: { label: "Rezervovaný", color: "#d4880f", bg: "rgba(212,136,15,0.08)" },
  sold: { label: "Predaný", color: "#c93a2e", bg: "rgba(201,58,46,0.08)" },
  unavailable: { label: "Nedostupný", color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const fmt = (p: number) => new Intl.NumberFormat("sk-SK").format(p) + " €";
const fmtM = (p: number, s: number) => new Intl.NumberFormat("sk-SK").format(Math.round(p / s)) + " €/m²";
const smooth = { type: "tween" as const, duration: 0.35, ease: [0.4, 0, 0.15, 1] as const };
const fadeIn = { initial: { opacity: 0 } as const, animate: { opacity: 1 } as const, exit: { opacity: 0 } as const, transition: { duration: 0.2 } };

// ═══════════════════════════════════════════════════════════════
// BUILDING OVERLAY (same as before)
// ═══════════════════════════════════════════════════════════════
function BuildingOverlay({ floors, selectedFloor, onSelectFloor, interactive }: {
  floors: Floor[]; selectedFloor: number | null; onSelectFloor: (id: number) => void; interactive: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="relative">
      <img src="/selector.png" alt="Building" className="w-full block" draggable={false} />
      <svg viewBox="0 0 600 579" className="absolute inset-0 w-full h-full" style={{ pointerEvents: interactive ? "auto" : "none" }}>
        {floors.map(floor => {
          const pts = FLOOR_ZONES[floor.id]; if (!pts) return null;
          const isSel = selectedFloor === floor.id;
          const isHov = hovered === floor.id;
          const coords = pts.split(" ").map(p => p.split(",").map(Number));
          const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          return (
            <g key={floor.id} onClick={() => onSelectFloor(floor.id)}
              onMouseEnter={() => setHovered(floor.id)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <polygon points={pts}
                fill={isSel ? "rgba(48,145,179,0.35)" : isHov ? "rgba(48,145,179,0.2)" : "transparent"}
                stroke={isSel ? "#3091b3" : isHov ? "#3091b3" : "transparent"}
                strokeWidth={isSel ? 3 : isHov ? 2 : 0} />
              {(isSel || isHov) && (
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={interactive ? "16" : "13"} fontWeight="700" fill="#fff"
                  style={{ pointerEvents: "none", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{floor.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FLOOR PLAN with PNG image + SVG polygon overlay
// ═══════════════════════════════════════════════════════════════
function FloorPlanImage({ floor, selectedFlat, onSelectFlat, interactive }: {
  floor: Floor; selectedFlat: Unit | null; onSelectFlat: (f: Unit) => void; interactive: boolean;
}) {
  const vb = FLOOR_PLAN_VB[floor.id] || { w: 800, h: 400 };
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative">
      <img src={`/floor-${floor.id}.png`} alt={`Floor ${floor.id}`} className="w-full block" draggable={false} />
      <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: interactive ? "auto" : "none" }}>
        {floor.flats.map(flat => {
          const pts = FLAT_PLAN_ZONES[flat.id];
          if (!pts) return null;
          const isSel = selectedFlat?.id === flat.id;
          const isHov = hovered === flat.id;
          const st = ST[flat.status] || ST.unavailable;
          const isSold = flat.status === "sold";
          const coords = pts.split(" ").map(p => p.split(",").map(Number));
          const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;

          return (
            <g key={flat.id}
              onClick={() => !isSold && onSelectFlat(flat)}
              onMouseEnter={() => setHovered(flat.id)}
              onMouseLeave={() => setHovered(null)}
              className={!isSold ? "cursor-pointer" : ""}>
              <polygon points={pts}
                fill={isSel ? "rgba(48,145,179,0.25)" : isHov ? "rgba(48,145,179,0.15)" : isSold ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)"}
                stroke={isSel ? "#3091b3" : isHov ? "#3091b3" : st.color}
                strokeWidth={isSel ? 3 : isHov ? 2 : 1}
                strokeDasharray={isSold ? "6,3" : "none"}
              />
              {/* Labels */}
              {interactive ? (
                <>
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize="16" fontWeight="700"
                    fill={isSold ? "#999" : "#333"} style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}>{flat.id}</text>
                  <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11"
                    fill={isSold ? "#aaa" : "#666"} style={{ pointerEvents: "none" }}>{flat.rooms} · {flat.interior_area} m²</text>
                  <circle cx={cx} cy={cy + 24} r="4" fill={st.color} />
                </>
              ) : (
                <text x={cx} y={cy + 5} textAnchor="middle" fontSize="22" fontWeight="700"
                  fill={isSel ? "#3091b3" : isSold ? "#ccc" : "#aaa"}
                  style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(255,255,255,0.5)" }}>{flat.id}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FLAT DETAIL
// ═══════════════════════════════════════════════════════════════
function FlatDetail({ flat }: { flat: Unit }) {
  const st = ST[flat.status] || ST.unavailable;
  const extLabel = flat.exterior_area > 0 ? `${flat.exterior_type || "exteriér"} ${flat.exterior_area} m²` : "—";

  return (
    <div>
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Detail jednotky</p>
      <h3 className={`text-2xl text-stone-800 mt-1 mb-4 ${avenirHeading}`}>{flat.name}</h3>

      {/* Flat floor plan image */}
      <div className="rounded-lg border border-stone-200 overflow-hidden mb-5">
        <img src={`/flat-${flat.id}.png`} alt={`${flat.name} pôdorys`} className="w-full block"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { l: "Dispozícia", v: flat.rooms || "—" },
          { l: "Úžitková plocha", v: `${flat.interior_area} m²` },
          { l: "Orientácia", v: flat.orientation || "—" },
          { l: "Exteriér", v: extLabel },
          { l: "Podlažie", v: `${flat.floor_number}. NP` },
          { l: "Cena za m²", v: flat.status !== "sold" && flat.price_per_m2 ? fmtM(flat.price, flat.interior_area) : "—" },
        ].map(({ l, v }) => (
          <div key={l} className="bg-[#faf8f4] rounded-lg p-2.5">
            <div className="text-[9px] text-stone-400 uppercase tracking-wider font-bold">{l}</div>
            <div className="text-sm font-bold text-stone-800 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4" style={{ background: st.bg }}>
        <div className="w-2 h-2 rounded-full" style={{ background: st.color }} />
        <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
      </div>

      {flat.status !== "sold" && flat.price > 0 && (
        <div className="bg-gradient-to-br from-[#3091b3] to-[#247a96] rounded-xl p-5 text-white mb-4 relative overflow-hidden">
          <div className="absolute top-[-30px] right-[-30px] w-24 h-24 rounded-full bg-white/5" />
          <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Celková cena</p>
          <p className={`text-3xl mt-1 ${avenirHeading}`}>{fmt(flat.price)}</p>
        </div>
      )}

      {flat.status === "available" && (
        <div className="flex flex-col gap-2.5">
          <Link href="/#kontakt" className={`w-full py-4 rounded-lg bg-[#544740] text-white uppercase tracking-widest text-sm hover:bg-[#3a302a] transition-colors shadow-lg text-center ${avenirHeading}`}>Mám záujem</Link>
          <a href="#" onClick={e => e.preventDefault()} className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-[#544740] text-[#544740] text-sm font-bold hover:bg-[#544740]/5 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
            Stiahnuť pôdorys (PDF)
          </a>
        </div>
      )}
      {flat.status === "reserved" && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 text-center leading-relaxed">
          Jednotka je momentálne rezervovaná.<br />Kontaktujte nás pre viac informácií.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════════════════════
function ListView({ floors, onSelectFlat }: { floors: Floor[]; onSelectFlat: (f: Unit) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#3091b3]/20">
            {["Jednotka", "Podlažie", "Typ", "Dispozícia", "Plocha", "Exteriér", "Orient.", "Cena", "€/m²", "Stav", ""].map(h => (
              <th key={h} className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-stone-400 font-bold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {floors.flatMap(floor => floor.flats.map(flat => {
            const st = ST[flat.status] || ST.unavailable;
            const isSold = flat.status === "sold";
            return (
              <tr key={flat.id} className={`border-b border-stone-200/50 ${isSold ? "opacity-50" : "hover:bg-[#3091b3]/5"}`}>
                <td className="py-3 px-3 font-bold text-stone-800">{flat.name}</td>
                <td className="py-3 px-3 text-stone-600">{flat.floor_number}. NP</td>
                <td className="py-3 px-3 text-stone-500 text-xs">{flat.unit_type}</td>
                <td className="py-3 px-3 text-stone-600">{flat.rooms}</td>
                <td className="py-3 px-3 text-stone-600">{flat.interior_area} m²</td>
                <td className="py-3 px-3 text-stone-500 text-xs">{flat.exterior_area > 0 ? `${flat.exterior_area} m²` : "—"}</td>
                <td className="py-3 px-3 text-stone-600">{flat.orientation}</td>
                <td className={`py-3 px-3 font-bold whitespace-nowrap ${isSold ? "text-stone-400" : "text-stone-800"}`}>{isSold ? "—" : fmt(flat.price)}</td>
                <td className="py-3 px-3 text-stone-400 text-xs whitespace-nowrap">{flat.price_per_m2 ? `${fmt(Math.round(flat.price_per_m2))}` : "—"}</td>
                <td className="py-3 px-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                  </span>
                </td>
                <td className="py-3 px-3">{!isSold && <button onClick={() => onSelectFlat(flat)} className="text-[#3091b3] text-xs font-bold uppercase tracking-wider hover:underline">Detail →</button>}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND + THUMB (same as before)
// ═══════════════════════════════════════════════════════════════
const bgRows = Array(80).fill(null); const bgSeqs = Array(8).fill(null);
const BG = React.memo(() => (
  <div className="absolute inset-0 -z-10 flex flex-col gap-12 bg-[#DBDAC8] overflow-hidden py-12">
    {bgRows.map((_, ri) => (<div key={ri} className="flex gap-16 w-max px-12 h-32 shrink-0">{bgSeqs.map((_, si) => (
      <React.Fragment key={si}><div className="flex gap-8"><div className="w-[29px] bg-[#3091b3] h-full" /><div className="w-[29px] bg-[#3091b3] h-full" /></div>
      <div className="flex gap-8"><div className="w-[29px] bg-[#3091b3] h-full" /><div className="w-[29px] bg-[#3091b3] h-full" /><div className="w-[29px] bg-[#3091b3] h-full" /><div className="w-[29px] bg-[#3091b3] h-full" /></div></React.Fragment>
    ))}</div>))}
  </div>
)); BG.displayName = 'BG';

function Thumb({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.div {...fadeIn} onClick={onClick} className="relative rounded-lg overflow-hidden ring-1 ring-stone-300/60 shadow cursor-pointer hover:ring-2 hover:ring-[#3091b3] group">
      <p className="text-center text-stone-500 text-[10px] uppercase tracking-wider font-bold pt-1">{label}</p>
      {children}
      <div className="absolute inset-0 z-10" />
      <div className="absolute top-2 right-2 z-20 bg-[#3091b3] text-white rounded px-2 py-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">← Späť</div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FLOOR TYPE MAP
// ═══════════════════════════════════════════════════════════════
const FLOOR_TYPE: Record<number, string> = { 2: "Standard", 3: "Standard", 4: "Loft", 5: "Loft", 6: "Penthouse" };
const FLOOR_LABEL: Record<number, string> = { 2: "2. NP", 3: "3. NP", 4: "4. NP", 5: "5. NP", 6: "6. NP" };

function groupByFloor(units: Unit[]): Floor[] {
  const map = new Map<number, Unit[]>();
  units.forEach(u => {
    if (!map.has(u.floor_number)) map.set(u.floor_number, []);
    map.get(u.floor_number)!.push(u);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([floorNum, flats]) => ({
      id: floorNum,
      label: FLOOR_LABEL[floorNum] || `${floorNum}. NP`,
      type: FLOOR_TYPE[floorNum] || "Standard",
      flats: flats.sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function CennikPage() {
  const [tab, setTab] = useState<'3d' | 'list'>('3d');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedFlat, setSelectedFlat] = useState<Unit | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  // Fetch units from Supabase
  useEffect(() => {
    fetch('/api/units')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUnits(data); })
      .catch(console.error)
      .finally(() => setLoadingUnits(false));
  }, []);

  const floors = groupByFloor(units);
  const allFlats = units;
  const availCount = allFlats.filter(f => f.status === "available").length;

  const step = selectedFlat ? 2 : selectedFloor ? 1 : 0;
  const currentFloor = selectedFloor ? floors.find(f => f.id === selectedFloor) || null : null;
  const goStep = (s: number) => { if (s === 0) { setSelectedFloor(null); setSelectedFlat(null); } if (s === 1) { setSelectedFlat(null); } };

  return (
    <main className={`text-stone-800 selection:bg-amber-700 selection:text-white ${avenirBody} relative min-h-screen`}>
      <BG />
      <div className="w-full h-1 bg-[#544740] fixed top-0 left-0 z-50" />

      {/* HEADER */}
      <nav className={`fixed top-1 left-0 w-full h-40 z-40 bg-[#3091b3]/40 backdrop-blur-sm shadow-md transition-transform duration-500 ease-in-out flex items-center justify-center px-6 md:px-12`}>
        <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2">
          <Link href="/" className="flex items-center gap-3 text-[#d7d9c7] hover:text-white transition-colors group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-hover:-translate-x-1 transition-transform"><polyline points="15 18 9 12 15 6" /></svg>
            <span className={`text-sm uppercase tracking-widest hidden sm:inline ${avenirHeading}`}>Späť</span>
          </Link>
        </div>
        <Link href="/"><img src="/logo.svg" alt="Logo" className="h-14 sm:h-35 w-auto object-contain" /></Link>
        <div className="w-[80px]" />
      </nav>

      {/* CONTENT */}
      <div className="pt-48 pb-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto w-full bg-[#d7d9c7]/70 backdrop-blur-sm shadow-xl relative z-10 rounded-sm overflow-hidden">

          {/* Title */}
          <div className="text-center pt-10 pb-4 px-6">
            <p className="text-xs font-bold text-[#3091b3] uppercase tracking-[0.2em] mb-2">Cenník & výber</p>
            <h1 className={`text-3xl sm:text-5xl text-stone-800 mb-3 tracking-wide uppercase ${avenirHeading}`}>Vyberte si bývanie</h1>
            <div className="w-24 h-[1px] bg-[#3091b3] mx-auto mb-3" />
            {loadingUnits ? (
              <p className="text-stone-400 text-sm">Načítavam jednotky...</p>
            ) : (
              <p className="text-stone-600 text-sm">{allFlats.length} jednotiek · <span className="text-[#2a9d5c] font-bold">{availCount} voľných</span></p>
            )}
          </div>

          {/* TABS */}
          <div className="flex justify-center gap-1 px-6 pb-6">
            {([
              { key: '3d' as const, label: '3D výberovník', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3M19 10v10a1 1 0 01-1 1h-3' },
              { key: 'list' as const, label: 'Zoznam', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
            ]).map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'list') goStep(0); }}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-colors ${
                  tab === t.key ? 'bg-white text-[#3091b3] shadow-sm' : 'text-stone-500 hover:text-stone-700 hover:bg-white/30'
                }`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={t.icon} /></svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="px-4 md:px-6 py-6 min-h-[500px]">

            {/* LIST */}
            {tab === 'list' && (
              <motion.div key="list" {...fadeIn}>
                <ListView floors={floors} onSelectFlat={(f) => { setSelectedFlat(f); setSelectedFloor(f.floor_number); setTab('3d'); }} />
              </motion.div>
            )}

            {/* 3D SELECTOR */}
            {tab === '3d' && (
              <motion.div key="3d" {...fadeIn}>

                {/* Breadcrumb */}
                <AnimatePresence>
                  {step > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={smooth}
                      className="mb-4 flex items-center gap-1 flex-wrap overflow-hidden">
                      {[
                        { label: "Budova", s: 0 },
                        ...(step >= 1 && currentFloor ? [{ label: currentFloor.label, s: 1 }] : []),
                        ...(step >= 2 && selectedFlat ? [{ label: selectedFlat.name, s: 2 }] : []),
                      ].map((item, i, arr) => (
                        <React.Fragment key={i}>
                          {i > 0 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" className="mx-1"><polyline points="9 18 15 12 9 6" /></svg>}
                          <button onClick={() => goStep(item.s)}
                            className={`text-xs px-2 py-1 rounded ${i === arr.length - 1 ? 'bg-[#3091b3]/10 text-[#3091b3] font-bold' : 'text-stone-500 hover:text-stone-700'}`}>
                            {item.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col lg:flex-row gap-4">

                  {/* SIDEBAR */}
                  <motion.div animate={{ width: step > 0 ? 200 : "100%", maxWidth: step > 0 ? 200 : 600 }}
                    transition={smooth} className={`flex flex-col gap-3 shrink-0 overflow-hidden ${step === 0 ? "mx-auto" : ""}`} style={{ willChange: "width" }}>

                    {step === 0 ? (
                      <motion.div key="building-full" {...fadeIn} className="rounded-lg overflow-hidden">
                        <p className="text-center text-stone-500 text-sm py-2">Kliknite na podlažie</p>
                        <BuildingOverlay floors={floors} selectedFloor={selectedFloor}
                          onSelectFloor={(id) => { setSelectedFloor(id); setSelectedFlat(null); }} interactive={true} />
                      </motion.div>
                    ) : (
                      <Thumb label="Budova" onClick={() => goStep(0)}>
                        <BuildingOverlay floors={floors} selectedFloor={selectedFloor} onSelectFloor={() => {}} interactive={false} />
                      </Thumb>
                    )}

                    <AnimatePresence>
                      {step === 2 && currentFloor && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={smooth} className="overflow-hidden">
                          <Thumb label={currentFloor.label} onClick={() => goStep(1)}>
                            <div className="p-1">
                              <FloorPlanImage floor={currentFloor} selectedFlat={selectedFlat} onSelectFlat={() => {}} interactive={false} />
                            </div>
                          </Thumb>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* MAIN AREA */}
                  <div className="flex-1 min-w-0">
                    <AnimatePresence mode="wait">

                      {step === 1 && currentFloor && (
                        <motion.div key={`fp-${currentFloor.id}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={smooth}
                          className="bg-white rounded-lg border border-stone-200 shadow-md overflow-hidden">
                          <div className="px-5 pt-4 pb-2 flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Pôdorys podlažia</p>
                              <h3 className={`text-xl text-stone-800 ${avenirHeading}`}>
                                {currentFloor.label}
                                <span className="text-sm font-normal text-stone-400 ml-2">{currentFloor.type === "Loft" ? "Loft (mezonet)" : currentFloor.type === "Penthouse" ? "Penthouse" : "Štandardné"}</span>
                              </h3>
                            </div>
                            <div className="flex gap-3">
                              {Object.entries(ST).filter(([k]) => k !== 'unavailable').map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                                  <span className="text-[10px] text-stone-500">{v.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="px-3 pb-3">
                            <FloorPlanImage floor={currentFloor} selectedFlat={selectedFlat}
                              onSelectFlat={(f) => setSelectedFlat(f)} interactive={true} />
                          </div>
                        </motion.div>
                      )}

                      {step === 2 && selectedFlat && (
                        <motion.div key={`detail-${selectedFlat.id}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={smooth}
                          className="bg-white rounded-lg border border-stone-200 shadow-md p-5 lg:p-6">
                          <FlatDetail flat={selectedFlat} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {step === 0 && <p className="text-center text-stone-400 text-xs mt-6">Podlažie → byt → detail s pôdorysom</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-[#3091b3] py-12 text-center flex flex-col items-center gap-6">
        <Link href="/" className="text-stone-300 hover:text-amber-500 transition-colors text-xs tracking-widest uppercase">← Späť na hlavnú stránku</Link>
        <div className="text-stone-300 text-xs tracking-widest uppercase">© {new Date().getFullYear()} Zieger Mill. Všetky práva vyhradené.</div>
      </footer>
    </main>
  );
}