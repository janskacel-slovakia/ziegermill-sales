'use client';

import React, { useState } from 'react';
import { User, Logo, Bars } from './shared';

const input = 'w-full px-4 py-3 bg-white text-zm-ink placeholder:text-zm-muted/70 border border-zm-neutral rounded-lg focus:ring-2 focus:ring-zm-blue focus:border-transparent outline-none';
const label = 'block text-xs font-bold text-zm-dark uppercase tracking-wider mb-1';
const submit = 'w-full py-3 bg-zm-orange text-zm-ink rounded-lg font-bold uppercase tracking-wider hover:brightness-95 transition-colors disabled:opacity-50';

type Mode = 'login' | 'register' | 'forgot';

// Login, registration (an agent's first visit; the admin approves it) and "forgot password".
export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Chyba');
    return d;
  };
  const run = (f: (form: FormData) => Promise<void>) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try { await f(new FormData(e.currentTarget)); } catch (err: any) { setError(err.message); }
    setBusy(false);
  };
  const switchTo = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const login = run(async f => {
    await post('/api/admin/login', { username: f.get('username'), password: f.get('password'), remember: f.get('remember') === 'on' });
    const me = await fetch('/api/admin/me').then(r => r.json());
    onLogin(me.user);
  });
  const register = run(async f => {
    if (f.get('password') !== f.get('password2')) throw new Error('Heslá sa nezhodujú');
    await post('/api/admin/register', { email: f.get('email'), display_name: f.get('display_name'), phone: f.get('phone'), password: f.get('password'), website: f.get('website') });
    setMode('login');
    setInfo('Registrácia odoslaná. Prihlásiť sa môžete po schválení administrátorom.');
  });
  const forgot = run(async f => {
    const d = await post('/api/admin/password-reset', { email: f.get('email') });
    setInfo(d.message);
  });

  return (
    <div className="min-h-screen bg-zm-blue flex flex-col">
      <Bars />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Logo className="h-16" />
          <p className="text-white text-sm mt-3 font-medium tracking-wide">Administrácia predaja</p>
        </div>
        <div className="flex mb-3 bg-white rounded-lg p-1 shadow-sm">
          {([['login', 'Prihlásenie'], ['register', 'Registrácia']] as [Mode, string][]).map(([m, l]) => (
            <button key={m} onClick={() => switchTo(m)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md ${mode === m || (m === 'login' && mode === 'forgot') ? 'bg-zm-dark text-white' : 'text-zm-dark hover:bg-zm-paper'}`}>{l}</button>
          ))}
        </div>

        {mode === 'login' && (
          <form onSubmit={login} className="bg-white rounded-xl shadow-lg p-8 space-y-4">
            <div><label className={label}>Email</label><input name="username" required autoFocus autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={input} /></div>
            <div><label className={label}>Heslo</label><input name="password" type="password" required autoComplete="current-password" className={input} /></div>
            <label className="flex items-center gap-2 text-sm text-zm-ink select-none"><input type="checkbox" name="remember" defaultChecked className="w-4 h-4 accent-[#3091b2]" /> Zapamätať si ma (30 dní)</label>
            {info && <p className="text-green-700 text-sm text-center bg-green-50 p-2 rounded">{info}</p>}
            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
            <button type="submit" disabled={busy} className={submit}>Prihlásiť sa</button>
            <button type="button" onClick={() => switchTo('forgot')} className="w-full text-sm text-zm-dark hover:text-zm-blue underline-offset-2 hover:underline">Zabudnuté heslo?</button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={register} className="bg-white rounded-xl shadow-lg p-8 space-y-4">
            <p className="text-xs text-zm-muted">Pre makléra pri prvom príchode. Prístup sprístupní administrátor po schválení.</p>
            <div><label className={label}>Meno a priezvisko</label><input name="display_name" required autoComplete="name" className={input} /></div>
            <div><label className={label}>Email</label><input name="email" type="email" required autoComplete="email" className={input} /></div>
            <div><label className={label}>Telefón</label><input name="phone" type="tel" autoComplete="tel" className={input} /></div>
            <div><label className={label}>Heslo (aspoň 10 znakov)</label><input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} /></div>
            <div><label className={label}>Heslo znova</label><input name="password2" type="password" required minLength={10} autoComplete="new-password" className={input} /></div>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
            <button type="submit" disabled={busy} className={submit}>Zaregistrovať sa</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={forgot} className="bg-white rounded-xl shadow-lg p-8 space-y-4">
            <p className="text-sm text-zm-dark">Zadajte email, s ktorým sa prihlasujete. Pošleme vám odkaz na nastavenie nového hesla.</p>
            <div><label className={label}>Email</label><input name="email" type="email" required autoFocus defaultValue={email} autoComplete="email" className={input} /></div>
            {info && <p className="text-green-700 text-sm text-center bg-green-50 p-2 rounded">{info}</p>}
            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
            <button type="submit" disabled={busy} className={submit}>Poslať odkaz</button>
            <button type="button" onClick={() => switchTo('login')} className="w-full text-sm text-zm-dark hover:text-zm-blue underline-offset-2 hover:underline">← Späť na prihlásenie</button>
          </form>
        )}
      </div>
      </div>
      <Bars />
    </div>
  );
}
