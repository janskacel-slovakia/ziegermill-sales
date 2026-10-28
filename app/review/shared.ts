// Shared by the review page and its print view (/review/print).
export type Status = 'open' | 'answered' | 'agreed' | 'done';
export type Photo = { path: string; name: string; w?: number; h?: number; url?: string | null };
export type Msg = { id: string; by: 'user' | 'claude' | 'architect'; author_name: string | null; text: string; origin: string; created_at: string; photos: Photo[] };
export type Point = {
  id: string; n: number; date: string | null; unit: string | null; page: number; plan: string; at: [number, number]; title: string; text: string;
  source: string | null; view: { kind: string; flat?: string } | null; status: Status; status_at: string; status_by: string | null;
  still: { url: string | null; pin: [number, number] | null } | null; walk_url: string; messages: Msg[];
};
export type Page = { page: number; plan: string; name: string; w: number; h: number; map: [number, number, number]; png: string; px: [number, number]; url: string | null };
export type Me = { id: number; display_name: string; role: 'admin' | 'architect' };

export const ST: Record<Status, { label: string; short: string; bg: string; fg: string }> = {
  open: { label: 'Otvorené – čaká na architekta', short: 'Otvorené', bg: '#ffa62b', fg: '#231f20' },
  answered: { label: 'Zodpovedané architektom', short: 'Zodpovedané', bg: '#3091b2', fg: '#ffffff' },
  agreed: { label: 'Dohodnuté', short: 'Dohodnuté', bg: '#04318c', fg: '#ffffff' },
  done: { label: 'Hotové', short: 'Hotové', bg: '#8a8f7c', fg: '#ffffff' },
};
export const PLAN_LABEL = (p: string) => p.replace(/^(\d)NP(m?)$/, (_, n, m) => `${n}. NP${m ? ' medzipodlažie' : ''}`).replace('1PP', '1. PP');
export const when = (s: string) => new Date(s).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// as studio/architect.html / _architect/make_pdf.py: DXF metres -> PDF points of the sheet
export const toPt = (p: Page, at: number[]) => [p.map[0] * 1000 * at[0] + p.map[1], -p.map[0] * 1000 * at[1] + p.map[2]];
// who wrote a thread entry
export const who = (m: Msg) => m.by === 'architect' ? (m.author_name || 'Architekt') : m.by === 'claude' ? 'Claude (asistent)' : (m.origin === 'studio' ? 'Jano Skácel' : (m.author_name || 'Jano Skácel'));

export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `Chyba ${r.status}`), { status: r.status });
  return d;
}
