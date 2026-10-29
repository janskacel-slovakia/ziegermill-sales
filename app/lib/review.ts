import crypto from 'crypto';
import { getSupabaseAdmin, AdminUser } from './admin-auth';
import { mailConfigured, sendMail, siteUrl } from './mail';

// The architect review (/review, 19 Oct 2026). Points come from the Studio (_architect\notes.json, synced by
// flats\_architect\review_sync.py through /api/review/sync); the thread and the status live here and go back to the Studio.
export const REVIEW_BUCKET = 'review';
export type Status = 'open' | 'answered' | 'agreed' | 'done';
export const STATUSES: Status[] = ['open', 'answered', 'agreed', 'done'];
// what each side may set: the architect answers or agrees; Jano (admin) anything
export const ARCHITECT_STATUSES: Status[] = ['answered', 'agreed'];
export type By = 'user' | 'claude' | 'architect';

export type Photo = { path: string; name: string; w?: number; h?: number };
export type View = { kind: 'flat' | 'common' | 'exterior' | 'none'; flat?: string; cam?: { x: number; z: number; feet: number; yaw: number; pitch: number }; pos?: number[]; marks?: unknown[]; note?: { flat: string; id: string; n: number } };

export const WALK_BASE = (process.env.NEXT_PUBLIC_WALK_BASE || 'https://3d.ziegermill.sk').replace(/\/$/, '');

// The published walkthrough at the point, in walks-studio's deep-link format (flats/studio/notetools.js viewLink):
// ?nv=<base64url JSON {v: 1, flat, id, n, label, title, text, pos, cam, marks, status}> opens at the viewpoint with the pin and its
// marks. The exterior has no published free view yet: the 3D selector.
export function walkUrl(p: { id: string; n: number; title: string; text?: string; status?: string; view: View | null }) {
  const v = p.view;
  if (!v || !v.flat || v.kind === 'exterior' || v.kind === 'none') return `${WALK_BASE}/walk/selector/index.html?lang=sk`;
  const text = (p.text || '').length > 600 ? p.text!.slice(0, 600) + '…' : (p.text || '');   // the link stays well under ~6 kB
  const nv = { v: 1, flat: v.flat, id: p.id, n: p.n, label: String(p.n), title: `${p.n}. ${p.title}`, text, pos: v.pos, cam: v.cam, marks: v.marks || [], status: p.status === 'done' ? 'done' : 'open' };
  return `${WALK_BASE}/walk/${v.flat}/index.html?${new URLSearchParams({ lang: 'sk', nv: Buffer.from(JSON.stringify(nv)).toString('base64url') })}`;
}

export function syncKeyOk(header: string | null) {
  const key = process.env.REVIEW_SYNC_KEY || '';
  const got = (header || '').replace(/^Bearer\s+/i, '');
  if (key.length < 32 || got.length !== key.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(key));
}

// A storage key for an uploaded photo: photos/<point>/<time>_<clean name>
export function photoPath(pointId: string, fileName: string) {
  const clean = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  return `photos/${pointId}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${clean}`;
}

export function cleanPhotos(v: unknown, pointId: string): Photo[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 12).filter((p: any) => p && typeof p.path === 'string' && p.path.startsWith(`photos/${pointId}/`) && !p.path.includes('..'))
    .map((p: any) => ({ path: p.path, name: String(p.name || '').slice(0, 120), w: Number(p.w) || undefined, h: Number(p.h) || undefined }));
}

// Everything the page needs: the points with their threads, signed picture links (1 h), the floor plan sheets.
export async function loadReview(opts: { withDeleted?: boolean; sign?: boolean } = {}) {
  const sb = getSupabaseAdmin();
  let q = sb.from('review_points').select('*, review_messages(id, by, author, text, photos, origin, studio_key, created_at, deleted_at)').order('n');
  if (!opts.withDeleted) q = q.is('deleted_at', null);
  const { data: points, error } = await q;
  if (error) throw new Error(error.message);
  const { data: names } = await sb.from('admin_users').select('username, display_name, role');
  const who = new Map((names || []).map(u => [u.username, u.display_name || u.username]));

  const paths = new Set<string>();
  for (const p of points || []) {
    if (p.still_path) paths.add(p.still_path);
    for (const m of p.review_messages || []) for (const f of m.photos || []) paths.add(f.path);
  }
  const sheetsRes = await sb.storage.from(REVIEW_BUCKET).download('sheets/pages.json');
  const sheets = sheetsRes.data ? JSON.parse(await sheetsRes.data.text()) : { pages: [] };
  for (const pg of sheets.pages || []) paths.add(`sheets/${pg.png}`);
  const signed = new Map<string, string>();
  if (opts.sign !== false && paths.size) {
    const { data } = await sb.storage.from(REVIEW_BUCKET).createSignedUrls([...paths], 3600);
    for (const s of data || []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }
  return {
    sheets: { panel: sheets.panel, pages: (sheets.pages || []).map((pg: any) => ({ ...pg, url: signed.get(`sheets/${pg.png}`) || null })) },
    points: (points || []).map(p => ({
      id: p.id, n: p.n, date: p.date, unit: p.unit, page: p.page, plan: p.plan, at: p.at, title: p.title, text: p.text, source: p.source,
      view: p.view, important: !!p.important, status: p.status, status_at: p.status_at, status_by: p.status_by ? (who.get(p.status_by) || p.status_by) : null,
      studio_at: p.studio_at, deleted_at: p.deleted_at,
      still: p.still_path ? { url: signed.get(p.still_path) || null, path: p.still_path, pin: p.still_pin } : null,
      walk_url: walkUrl(p),
      messages: (p.review_messages || []).filter((m: any) => opts.withDeleted || !m.deleted_at)
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map((m: any) => ({ id: m.id, by: m.by, author: m.author, author_name: m.author === 'studio' ? null : (who.get(m.author) || m.author),
          text: m.text, origin: m.origin, studio_key: m.studio_key, created_at: m.created_at, deleted_at: m.deleted_at,
          photos: (m.photos || []).map((f: Photo) => ({ ...f, url: signed.get(f.path) || null })) })),
    })),
  };
}

// Emails, only once app/lib/mail.ts is configured (until then nothing, quietly). Never with the personal link in them.
export async function notify(to: 'jano' | 'architect', items: { n: number; title: string; text: string }[], origin: string, from?: AdminUser) {
  if (!mailConfigured() || !items.length) return;
  const sb = getSupabaseAdmin();
  const { data: users } = await sb.from('admin_users').select('username, email, display_name')
    .eq('role', to === 'jano' ? 'admin' : 'architect').eq('is_active', true);
  const site = siteUrl(origin);
  const lines = items.map(i => `${i.n}. ${i.title}\n${i.text}\n${site}/review?p=${i.n}`).join('\n\n');
  const subject = to === 'jano'
    ? `Ziegermill – architekt odpovedal (${items.map(i => i.n).join(', ')})`
    : `Ziegermill – nové pripomienky / odpovede (${items.map(i => i.n).join(', ')})`;
  const head = to === 'jano' ? `${from?.display_name || 'Architekt'} odpovedal na pripomienky:` : 'Dobrý deň,\n\nk pripomienkam k výkresom pribudlo:';
  for (const u of users || []) {
    const addr = u.email || (u.username.includes('@') ? u.username : null);
    if (!addr) continue;
    await sendMail({ to: addr, subject, text: `${head}\n\n${lines}\n` }).catch(() => {});
  }
}
