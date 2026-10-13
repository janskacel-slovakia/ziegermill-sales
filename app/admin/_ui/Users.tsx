'use client';

import React, { useEffect, useState } from 'react';
import { User, Activity, api, dateTime, Card, Th, Field, inputCls, btnPrimary, btnGrey, btnSoft, btnDanger, ErrorLine, ActivityList } from './shared';

type Row = User & { is_active: boolean; last_login: string | null; requested_at: string | null; approved_at: string | null };

// Own account (everybody): name, sending email, phone, password.
export function Account({ user, onChanged }: { user: User; onChanged: (relogin: boolean) => void }) {
  const [d, setD] = useState({ display_name: user.display_name, email: user.email || '', phone: user.phone || '', password: '', password2: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const save = async () => {
    setErr(''); setMsg('');
    if (d.password && d.password !== d.password2) return setErr('Heslá sa nezhodujú');
    const body: Record<string, unknown> = {};
    for (const k of ['display_name', 'email', 'phone'] as const) if (d[k] !== ((user as any)[k] || '')) body[k] = d[k] || null;
    if (d.password) body.password = d.password;
    try { const r = await api(`/api/admin/users/${user.id}`, 'PATCH', body); setMsg('Uložené'); onChanged(!!r.relogin); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Card title="Môj účet">
      <div className="p-4 grid sm:grid-cols-2 gap-3 max-w-2xl">
        <Field label="Meno"><input className={inputCls} value={d.display_name} onChange={e => setD({ ...d, display_name: e.target.value })} /></Field>
        <Field label="Prihlasovacie meno"><input className={inputCls} disabled value={user.username} /></Field>
        <Field label="Email (odosielateľ emailov klientom)"><input type="email" className={inputCls} value={d.email} onChange={e => setD({ ...d, email: e.target.value })} /></Field>
        <Field label="Telefón (do podpisu)"><input className={inputCls} value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} /></Field>
        <Field label="Nové heslo (aspoň 10 znakov)"><input type="password" autoComplete="new-password" className={inputCls} value={d.password} onChange={e => setD({ ...d, password: e.target.value })} /></Field>
        <Field label="Nové heslo znova"><input type="password" autoComplete="new-password" className={inputCls} value={d.password2} onChange={e => setD({ ...d, password2: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex items-center gap-3"><button onClick={save} className={btnPrimary}>Uložiť</button>{msg && <span className="text-sm text-green-700">{msg}</span>}</div>
        <div className="sm:col-span-2"><ErrorLine error={err} /></div>
      </div>
    </Card>
  );
}

// Admin only: who may log in, with which role.
export default function Users({ user }: { user: User }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<Activity[]>([]);
  const [err, setErr] = useState('');
  const [n, setN] = useState({ username: '', display_name: '', role: 'agent', email: '', phone: '', password: '' });
  const load = () => {
    api<Row[]>('/api/admin/users').then(setRows).catch(e => setErr(e.message));
    api<Activity[]>('/api/admin/activity').then(setLog).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    setErr('');
    try { await api('/api/admin/users', 'POST', n); setN({ username: '', display_name: '', role: 'agent', email: '', phone: '', password: '' }); load(); } catch (e: any) { setErr(e.message); }
  };
  const patch = async (r: Row, body: Record<string, unknown>) => { setErr(''); try { await api(`/api/admin/users/${r.id}`, 'PATCH', body); load(); } catch (e: any) { setErr(e.message); } };
  const resetPw = (r: Row) => { const p = prompt(`Nové heslo pre ${r.username} (aspoň 10 znakov). Odovzdajte mu ho osobne alebo telefonicky.`); if (p) patch(r, { password: p }); };

  const pending = rows.filter(r => r.requested_at && !r.approved_at);
  const approve = (r: Row, role: string) => patch(r, { is_active: true, role });
  const reject = async (r: Row) => { if (confirm(`Zamietnuť registráciu ${r.username}?`)) { try { await api(`/api/admin/users/${r.id}`, 'DELETE'); load(); } catch (e: any) { setErr(e.message); } } };

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card title={<span className="text-zm-dark">Čakajúce registrácie ({pending.length})</span>}>
          <ul className="divide-y divide-zm-line">
            {pending.map(r => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-[14rem]"><b>{r.display_name}</b> · {r.username}{r.phone && ` · ${r.phone}`}<span className="text-xs text-zm-muted"> · {dateTime(r.requested_at!)}</span></span>
                <button onClick={() => approve(r, 'agent')} className={btnPrimary}>Schváliť ako makléra</button>
                <button onClick={() => approve(r, 'admin')} className={btnGrey}>…ako administrátora</button>
                <button onClick={() => reject(r)} className={btnDanger}>Zamietnuť</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Používatelia">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-b border-zm-neutral">{['Prihlásenie', 'Meno', 'Rola', 'Email', 'Telefón', 'Naposledy', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.filter(r => !(r.requested_at && !r.approved_at)).map(r => (
                <tr key={r.id} className={`border-b border-zm-line ${r.is_active ? '' : 'opacity-40'}`}>
                  <td className="py-2 px-3 font-mono text-xs">{r.username}</td>
                  <td className="py-2 px-3">{r.display_name}</td>
                  <td className="py-2 px-3">
                    <select value={r.role} disabled={r.id === user.id} onChange={e => patch(r, { role: e.target.value })} className="px-2 py-1 border rounded text-xs">
                      <option value="admin">administrátor</option><option value="agent">maklér</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-xs">{r.email}</td>
                  <td className="py-2 px-3 text-xs">{r.phone}</td>
                  <td className="py-2 px-3 text-xs text-zm-muted">{r.last_login ? dateTime(r.last_login) : '—'}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <button onClick={() => resetPw(r)} className={btnGrey}>Nové heslo</button>
                    {r.id !== user.id && <button onClick={() => patch(r, { is_active: !r.is_active })} className={`${btnSoft} ml-1`}>{r.is_active ? 'Zablokovať' : 'Povoliť'}</button>}
                    {r.id !== user.id && <button onClick={async () => { if (confirm(`Zmazať používateľa ${r.username}?`)) { try { await api(`/api/admin/users/${r.id}`, 'DELETE'); load(); } catch (e: any) { setErr(e.message); } } }} className={`${btnDanger} ml-1`}>Zmazať</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-zm-line grid sm:grid-cols-3 gap-3">
          <Field label="Prihlasovacie meno"><input className={inputCls} value={n.username} onChange={e => setN({ ...n, username: e.target.value })} placeholder="napr. email makléra" /></Field>
          <Field label="Meno"><input className={inputCls} value={n.display_name} onChange={e => setN({ ...n, display_name: e.target.value })} /></Field>
          <Field label="Rola"><select className={inputCls} value={n.role} onChange={e => setN({ ...n, role: e.target.value })}><option value="agent">maklér</option><option value="admin">administrátor</option></select></Field>
          <Field label="Email (odosielateľ)"><input type="email" className={inputCls} value={n.email} onChange={e => setN({ ...n, email: e.target.value })} /></Field>
          <Field label="Telefón"><input className={inputCls} value={n.phone} onChange={e => setN({ ...n, phone: e.target.value })} /></Field>
          <Field label="Úvodné heslo (aspoň 10 znakov)"><input type="text" autoComplete="off" className={inputCls} value={n.password} onChange={e => setN({ ...n, password: e.target.value })} /></Field>
          <div><button onClick={create} className={btnPrimary}>+ Pridať používateľa</button></div>
        </div>
        <ErrorLine error={err} />
      </Card>
      <Card title="Posledné zmeny (všetko)"><ActivityList items={log} /></Card>
    </div>
  );
}
