'use client';

import React, { useState, useEffect, useCallback } from 'react';

type Unit = {
  id: string; name: string; unit_type: string; floor_number: number; rooms: string;
  interior_area: number; exterior_area: number; exterior_type: string; orientation: string;
  price: number; price_per_m2: number; status: string; floor_plan_pdf_url: string;
  description: string; updated_at: string;
};
type Change = { id: number; unit_id: string; field_name: string; old_value: string; new_value: string; changed_by: string; changed_at: string; note: string };
type User = { id: number; username: string; display_name: string; role: string };

const ST_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "Voľný", color: "#16a34a", bg: "#f0fdf4" },
  reserved: { label: "Rezervovaný", color: "#ca8a04", bg: "#fefce8" },
  sold: { label: "Predaný", color: "#dc2626", bg: "#fef2f2" },
  unavailable: { label: "Nedostupný", color: "#6b7280", bg: "#f3f4f6" },
};

const fmt = (n: number) => new Intl.NumberFormat("sk-SK").format(n);

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Unit>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Change[]>([]);
  const [historyUnit, setHistoryUnit] = useState<string | null>(null);
  const [tab, setTab] = useState<'units' | 'history'>('units');

  // Check auth on mount
  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (r.ok) return r.json();
      throw new Error('Not logged in');
    }).then(d => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  // Load units when authenticated
  const loadUnits = useCallback(() => {
    fetch('/api/admin/units').then(r => r.json()).then(d => { if (Array.isArray(d)) setUnits(d); });
  }, []);

  useEffect(() => { if (user) loadUnits(); }, [user, loadUnits]);

  // Login handler
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    });
    const data = await res.json();
    if (res.ok) { setUser(data.user); } else { setLoginError(data.error || 'Chyba prihlásenia'); }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setUser(null);
    setUnits([]);
  };

  // Start editing
  const startEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditData({ price: unit.price, status: unit.status, interior_area: unit.interior_area, exterior_area: unit.exterior_area, rooms: unit.rooms, orientation: unit.orientation, name: unit.name, description: unit.description });
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/admin/units/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (res.ok) {
      loadUnits();
      setEditingId(null);
      setEditData({});
    }
    setSaving(false);
  };

  // Load history for a unit
  const loadHistory = async (unitId: string) => {
    setHistoryUnit(unitId);
    setTab('history');
    const res = await fetch(`/api/admin/units/${unitId}`);
    const data = await res.json();
    setHistory(data.history || []);
  };

  if (loading) return <div className="min-h-screen bg-stone-100 flex items-center justify-center"><p className="text-stone-400">Načítavam...</p></div>;

  // ═══ LOGIN SCREEN ═══
  if (!user) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-stone-800 uppercase tracking-wider">Zieger Mill</h1>
          <p className="text-stone-400 text-sm mt-1">Administrácia</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-8 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Používateľ</label>
            <input name="username" required autoFocus className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#3091b3] focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Heslo</label>
            <input name="password" type="password" required className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#3091b3] focus:border-transparent outline-none" />
          </div>
          {loginError && <p className="text-red-600 text-sm text-center bg-red-50 py-2 rounded">{loginError}</p>}
          <button type="submit" className="w-full py-3 bg-[#3091b3] text-white rounded-lg font-bold uppercase tracking-wider hover:bg-[#247a96] transition-colors">Prihlásiť sa</button>
        </form>
      </div>
    </div>
  );

  // ═══ DASHBOARD ═══
  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-black text-stone-800 uppercase tracking-wider">Zieger Mill Admin</h1>
          <div className="flex gap-1">
            <button onClick={() => setTab('units')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${tab === 'units' ? 'bg-[#3091b3] text-white' : 'text-stone-500 hover:bg-stone-100'}`}>Jednotky</button>
            <button onClick={() => setTab('history')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${tab === 'history' ? 'bg-[#3091b3] text-white' : 'text-stone-500 hover:bg-stone-100'}`}>História</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500">{user.display_name} <span className="text-stone-300">({user.role})</span></span>
          <button onClick={handleLogout} className="text-xs text-stone-400 hover:text-red-500 uppercase tracking-wider font-bold">Odhlásiť</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* ═══ UNITS TAB ═══ */}
        {tab === 'units' && (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
              <h2 className="font-bold text-stone-700">Prehľad jednotiek ({units.length})</h2>
              <button onClick={loadUnits} className="text-xs text-[#3091b3] font-bold hover:underline">↻ Obnoviť</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['ID', 'Názov', 'NP', 'Typ', 'Dispozícia', 'Plocha', 'Ext.', 'Orient.', 'Cena', '€/m²', 'Stav', 'Akcie'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-stone-400 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => {
                    const isEditing = editingId === unit.id;
                    const st = ST_LABELS[unit.status] || ST_LABELS.unavailable;
                    return (
                      <tr key={unit.id} className={`border-b border-stone-100 ${isEditing ? 'bg-blue-50/50' : 'hover:bg-stone-50'}`}>
                        <td className="py-3 px-3 font-mono font-bold text-stone-800">{unit.id}</td>
                        <td className="py-3 px-3">
                          {isEditing ? <input value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="w-full px-2 py-1 border rounded text-sm" /> : <span className="font-medium">{unit.name}</span>}
                        </td>
                        <td className="py-3 px-3 text-stone-600">{unit.floor_number}</td>
                        <td className="py-3 px-3 text-stone-500 text-xs">{unit.unit_type}</td>
                        <td className="py-3 px-3">
                          {isEditing ? <input value={editData.rooms || ''} onChange={e => setEditData(p => ({ ...p, rooms: e.target.value }))} className="w-20 px-2 py-1 border rounded text-sm" /> : unit.rooms}
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? <input type="number" value={editData.interior_area || ''} onChange={e => setEditData(p => ({ ...p, interior_area: +e.target.value }))} className="w-16 px-2 py-1 border rounded text-sm" /> : <>{unit.interior_area} m²</>}
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? <input type="number" value={editData.exterior_area || ''} onChange={e => setEditData(p => ({ ...p, exterior_area: +e.target.value }))} className="w-16 px-2 py-1 border rounded text-sm" /> : <>{unit.exterior_area} m²</>}
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? <input value={editData.orientation || ''} onChange={e => setEditData(p => ({ ...p, orientation: e.target.value }))} className="w-12 px-2 py-1 border rounded text-sm" /> : unit.orientation}
                        </td>
                        <td className="py-3 px-3 font-bold whitespace-nowrap">
                          {isEditing ? <input type="number" value={editData.price || ''} onChange={e => setEditData(p => ({ ...p, price: +e.target.value }))} className="w-24 px-2 py-1 border rounded text-sm" /> : <>{fmt(unit.price)} €</>}
                        </td>
                        <td className="py-3 px-3 text-stone-400 text-xs whitespace-nowrap">{fmt(Math.round(unit.price_per_m2))} €</td>
                        <td className="py-3 px-3">
                          {isEditing ? (
                            <select value={editData.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))} className="px-2 py-1 border rounded text-sm">
                              {Object.entries(ST_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button onClick={saveEdit} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 disabled:opacity-50">{saving ? '...' : '✓'}</button>
                              <button onClick={() => { setEditingId(null); setEditData({}); }} className="px-3 py-1 bg-stone-200 text-stone-600 rounded text-xs font-bold hover:bg-stone-300">✕</button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(unit)} className="px-3 py-1 bg-[#3091b3]/10 text-[#3091b3] rounded text-xs font-bold hover:bg-[#3091b3]/20">Upraviť</button>
                              <button onClick={() => loadHistory(unit.id)} className="px-3 py-1 bg-stone-100 text-stone-500 rounded text-xs font-bold hover:bg-stone-200">História</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
              <h2 className="font-bold text-stone-700">
                História zmien {historyUnit && <span className="text-[#3091b3]">— {historyUnit}</span>}
              </h2>
              <div className="flex gap-2">
                {/* Quick filter buttons per unit */}
                {units.slice(0, 8).map(u => (
                  <button key={u.id} onClick={() => loadHistory(u.id)}
                    className={`px-2 py-1 rounded text-xs font-bold ${historyUnit === u.id ? 'bg-[#3091b3] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{u.id}</button>
                ))}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="p-12 text-center text-stone-400">
                {historyUnit ? 'Žiadne zmeny zatiaľ' : 'Vyberte jednotku pre zobrazenie histórie'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['Dátum', 'Pole', 'Predtým', 'Potom', 'Zmenil'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-400 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(ch => (
                    <tr key={ch.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-3 px-4 text-stone-500 text-xs whitespace-nowrap">
                        {new Date(ch.changed_at).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-stone-700">{ch.field_name}</td>
                      <td className="py-3 px-4">
                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">{ch.old_value || '—'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">{ch.new_value || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-stone-400 text-xs">{ch.changed_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}