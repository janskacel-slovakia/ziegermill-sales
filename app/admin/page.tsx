'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, Unit, Parking as Space, Deal, api, Logo } from './_ui/shared';
import Units from './_ui/Units';
import Parking from './_ui/Parking';
import Deals from './_ui/Deals';
import Customers from './_ui/Customers';
import Templates from './_ui/Templates';
import Users, { Account } from './_ui/Users';
import Login from './_ui/Login';
import Dashboard from './_ui/Dashboard';

type Tab = 'dashboard' | 'deals' | 'units' | 'parking' | 'customers' | 'templates' | 'users' | 'account';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [units, setUnits] = useState<Unit[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [openDeal, setOpenDeal] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/me').then(r => (r.ok ? r.json() : Promise.reject())).then(d => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    try { const t = localStorage.getItem('admin.tab') as Tab | null; if (t) setTab(t); } catch {}
  }, []);

  const reload = useCallback(() => {
    api<Unit[]>('/api/admin/units').then(setUnits).catch(() => {});
    api<Space[]>('/api/admin/parking').then(setSpaces).catch(() => {});
    api<Deal[]>('/api/admin/deals').then(setDeals).catch(() => {});
  }, []);
  useEffect(() => { if (user) reload(); }, [user, reload]);

  const go = (t: Tab) => { setTab(t); try { localStorage.setItem('admin.tab', t); } catch {} };
  const showDeal = (id: string | null) => { if (id) go('deals'); setOpenDeal(id); };

  const handleLogout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); setUser(null); setUnits([]); setDeals([]); };

  if (loading) return <div className="min-h-screen bg-zm-blue flex items-center justify-center"><Logo className="h-14 opacity-80" /></div>;

  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'admin';
  const reservedLate = deals.filter(d => d.stage === 'reserved' && d.reserved_until && d.reserved_until < new Date().toISOString().slice(0, 10)).length;
  const tabs: [Tab, string][] = [
    ['dashboard', 'Prehľad'], ['deals', `Obchody${reservedLate ? ` ⚠${reservedLate}` : ''}`], ['units', 'Jednotky'], ['parking', 'Parkovanie'], ['customers', 'Klienti'],
    ['templates', 'Šablóny zmlúv'], ...(isAdmin ? [['users', 'Používatelia'] as [Tab, string]] : []), ['account', 'Môj účet'],
  ];

  return (
    <div className="min-h-screen bg-zm-paper">
      <header className="bg-zm-dark px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow">
        <div className="flex flex-wrap items-center gap-3">
          <Logo className="h-8" />
          <nav className="flex flex-wrap gap-1">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => go(k)} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${tab === k ? 'bg-zm-orange text-zm-ink' : 'text-zm-neutral hover:bg-white/10'}`}>{l}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white">{user.display_name} <span className="text-zm-neutral">({isAdmin ? 'administrátor' : 'maklér'})</span></span>
          <a href="/" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-zm-neutral text-zm-ink text-xs font-bold uppercase tracking-wider hover:bg-white">Otvoriť web ↗</a>
          <button onClick={handleLogout} className="text-xs text-zm-neutral hover:text-zm-orange uppercase tracking-wider font-bold">Odhlásiť</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-6">
        {tab === 'dashboard' && <Dashboard user={user} />}
        {tab === 'deals' && <Deals user={user} deals={deals} units={units} spaces={spaces} reload={reload} open={openDeal} setOpen={setOpenDeal} />}
        {tab === 'units' && <Units user={user} units={units} reload={reload} openDeal={showDeal} />}
        {tab === 'parking' && <Parking user={user} spaces={spaces} reload={reload} openDeal={showDeal} />}
        {tab === 'customers' && <Customers openDeal={showDeal} canDelete={isAdmin} />}
        {tab === 'templates' && <Templates user={user} />}
        {tab === 'users' && isAdmin && <Users user={user} />}
        {tab === 'account' && <Account user={user} onChanged={relogin => { if (relogin) handleLogout(); else fetch('/api/admin/me').then(r => r.json()).then(d => setUser(d.user)); }} />}
      </main>
    </div>
  );
}
