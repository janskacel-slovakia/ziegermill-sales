'use client';

import React, { useEffect, useState } from 'react';
import { Logo, Bars } from '../_ui/shared';

// The page behind the emailed "new password" link: /admin/reset?token=...
export default function ResetPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('password2')) return setError('Heslá sa nezhodujú');
    setBusy(true);
    const r = await fetch('/api/admin/password-reset', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: f.get('password') }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(true); else setError(d.error || 'Chyba');
  };

  const input = 'w-full px-4 py-3 bg-white text-zm-ink border border-zm-neutral rounded-lg focus:ring-2 focus:ring-zm-blue focus:border-transparent outline-none';
  return (
    <div className="min-h-screen bg-zm-blue flex flex-col">
      <Bars />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Logo className="h-16" />
          <p className="text-white text-sm mt-3 font-medium tracking-wide">Nové heslo</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
          {done ? (
            <>
              <p className="text-green-700 text-sm bg-green-50 p-3 rounded">Heslo je nastavené. Prihláste sa ním.</p>
              <a href="/admin" className="block text-center w-full py-3 bg-zm-orange text-zm-ink rounded-lg font-bold uppercase tracking-wider">Na prihlásenie</a>
            </>
          ) : !token ? (
            <p className="text-sm text-zm-dark">Odkaz je neúplný. Otvorte ho priamo z emailu alebo si <a href="/admin" className="text-zm-blue underline">vyžiadajte nový</a>.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><label className="block text-xs font-bold text-zm-dark uppercase tracking-wider mb-1">Nové heslo (aspoň 10 znakov)</label><input name="password" type="password" required minLength={10} autoFocus autoComplete="new-password" className={input} /></div>
              <div><label className="block text-xs font-bold text-zm-dark uppercase tracking-wider mb-1">Heslo znova</label><input name="password2" type="password" required minLength={10} autoComplete="new-password" className={input} /></div>
              {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 bg-zm-orange text-zm-ink rounded-lg font-bold uppercase tracking-wider hover:brightness-95 disabled:opacity-50">Nastaviť heslo</button>
            </form>
          )}
        </div>
      </div>
      </div>
      <Bars />
    </div>
  );
}
