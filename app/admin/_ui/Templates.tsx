'use client';

import React, { useEffect, useState } from 'react';
import { Template, User, KIND_LABELS, api, dateTime, Card, Th, Field, inputCls, btnPrimary, btnSoft, btnGrey, btnDanger, ErrorLine, uploadFile, downloadUrl } from './shared';

// The generic first drafts (RZ, ZBKZ, KZ, Štandard, prílohy). Each upload is a new version; the newest of the same
// kind + title is the current one, which "Pridať platné šablóny" copies into a deal.
export default function Templates({ user }: { user: User }) {
  const [list, setList] = useState<Template[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [up, setUp] = useState<{ file: File | null; kind: string; title: string; version: string; notes: string }>({ file: null, kind: 'RZ', title: '', version: '', notes: '' });

  const load = () => api<Template[]>('/api/admin/templates').then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const titles = [...new Set(list.filter(t => t.kind === up.kind).map(t => t.title))];

  const upload = async () => {
    setBusy(true); setErr('');
    try {
      if (!up.file) throw new Error('Vyberte súbor');
      const f = await uploadFile(`templates/${up.kind}`, up.file);
      await api('/api/admin/templates', 'POST', { ...f, kind: up.kind, title: up.title || KIND_LABELS[up.kind], version: up.version, notes: up.notes });
      setUp({ ...up, file: null, version: '', notes: '' });
      (document.getElementById('tpl-file') as HTMLInputElement).value = '';
      await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const patch = async (t: Template, body: Record<string, unknown>) => { try { await api(`/api/admin/templates/${t.id}`, 'PATCH', body); load(); } catch (e: any) { setErr(e.message); } };
  const del = async (t: Template) => { if (confirm(`Zmazať verziu „${t.title} ${t.version || ''}“ aj so súborom?`)) { try { await api(`/api/admin/templates/${t.id}`, 'DELETE'); load(); } catch (e: any) { setErr(e.message); } } };

  const shown = list.filter(t => showOld || t.is_current);
  return (
    <div className="space-y-4">
      <Card title="Nahrať šablónu / novú verziu">
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Druh">
            <select className={inputCls} value={up.kind} onChange={e => setUp({ ...up, kind: e.target.value, title: '' })}>{Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label="Názov">
            <input className={inputCls} list="tpl-titles" value={up.title} onChange={e => setUp({ ...up, title: e.target.value })} placeholder={KIND_LABELS[up.kind]} />
            <datalist id="tpl-titles">{titles.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Verzia"><input className={inputCls} value={up.version} onChange={e => setUp({ ...up, version: e.target.value })} placeholder="napr. 2026-10 po advokátovi" /></Field>
          <Field label="Poznámka"><input className={inputCls} value={up.notes} onChange={e => setUp({ ...up, notes: e.target.value })} /></Field>
          <input id="tpl-file" type="file" accept=".docx,.doc,.pdf,.odt" onChange={e => setUp({ ...up, file: e.target.files?.[0] || null })} className="text-sm sm:col-span-2 lg:col-span-3 self-center" />
          <div><button onClick={upload} disabled={busy || !up.file} className={btnPrimary}>{busy ? 'Nahrávam…' : 'Nahrať'}</button></div>
        </div>
        <p className="px-4 pb-4 text-xs text-zm-muted">Rovnaký druh + názov = nová verzia; platná je vždy najnovšia (dá sa prepnúť). Prílohy (pôdorysy, Vyhlásenie vlastníkov pozemkov…) nahrajte ako „Príloha“ s vlastným názvom.</p>
        <ErrorLine error={err} />
      </Card>

      <Card title="Šablóny" actions={<label className="flex items-center gap-2 text-xs text-zm-muted"><input type="checkbox" checked={showOld} onChange={e => setShowOld(e.target.checked)} /> aj staršie verzie</label>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zm-paper border-b border-zm-neutral">{['Druh', 'Názov', 'Verzia', 'Súbor', 'Nahral', 'Platná', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {shown.map(t => (
                <tr key={t.id} className={`border-b border-zm-line ${t.is_current ? '' : 'opacity-50'}`}>
                  <td className="py-2 px-3 text-xs font-bold">{t.kind}</td>
                  <td className="py-2 px-3">{t.title}{t.notes && <div className="text-xs text-zm-muted">{t.notes}</div>}</td>
                  <td className="py-2 px-3 text-xs">{t.version}</td>
                  <td className="py-2 px-3 text-xs"><a className="text-zm-blue hover:underline break-all" href={downloadUrl(t.storage_path, t.file_name)}>{t.file_name}</a></td>
                  <td className="py-2 px-3 text-xs text-zm-muted whitespace-nowrap">{t.uploaded_by}<br />{dateTime(t.uploaded_at)}</td>
                  <td className="py-2 px-3">{t.is_current ? <span className="text-xs text-green-700 font-bold">✓ platná</span>
                    : <button onClick={() => patch(t, { is_current: true })} className={btnSoft}>Nastaviť ako platnú</button>}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {t.is_current && <button onClick={() => patch(t, { is_current: false })} className={btnGrey}>Vyradiť</button>}
                    {user.role === 'admin' && <button onClick={() => del(t)} className={`${btnDanger} ml-1`}>Zmazať</button>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zm-muted">Zatiaľ žiadne šablóny. Nahrajte RZ, ZOBZ, KZ, Štandard a prílohy.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
