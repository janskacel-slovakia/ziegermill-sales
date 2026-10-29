# Ziegermill: sales website + 3D walkthroughs + 3D building selector

One place for all three. The website and the published 3D pages live in this repo. The Blender pipeline that makes the
3D (walkthroughs, selector model) and the local "studio" stay in their own folder (big Blender data, absolute paths) and
are reachable from here once that folder is added to Claude Code: start it with
`claude --add-dir "C:\Users\PC1\Documents\SKP_cleanup\blender_scene"`, or type `/add-dir` with that path, or put it
in `.claude\settings.json` as `{"permissions": {"additionalDirectories": ["C:\\Users\\PC1\\Documents\\SKP_cleanup\\blender_scene"]}}`.

| What | Where |
|---|---|
| Website (Next.js) | `C:\ZM-WEB` (this repo) |
| Published walkthroughs | `public/walk/a32/`, `public/walk/a25/`, `public/walk/byt01/` |
| Published building selector | `public/walk/selector/` |
| Blender pipeline + studio | `C:\Users\PC1\Documents\SKP_cleanup\blender_scene\flats` (called `flats\` below) |
| Brand files | `LOGO\` here (= `G:\My Drive\Nehnutelnosti\_Matadorka\_Predaj a prenajom\Marketing\Branding\LOGO`) |

## Rules from Jano (always)

- Work in the background only. Never take over the mouse, keyboard or screen.
- Never modify or save the SketchUp files, `model_exterior.blend` or `scene_v1*.blend`. They are read-only sources.
- Don't change system settings. Any persistent configuration change needs Jano's explicit OK first.
- Flats: no artificial lights added. **Never bake**: only adjust the Blender scenes and scripts. Jano bakes himself.
- Before running Blender or any heavy job, check Jano isn't baking or previewing. Look for processes whose command line
  matches `run_pipeline|bake_flat|post_flat|pano`. If one is running, do the work elsewhere (cloud, or wait).
- "IFC for building, notes for design": building geometry comes from the ASR IFC. Design decisions come from Jano's
  studio notes.
- The valid design is the tender documentation ("Tendrová dokumentácia", 2026):
  `G:\My Drive\Nehnutelnosti\_Matadorka\_Predaj a prenajom\_Tendrova dokumentacia\` (ASR\PDF, ASR\dxf, Statika ...;
  local DXF copies in `flats\_ref\dxf`). The 2023 building permit drawings (`_Scale - esencia\_Konanie\Stavebne povolenie`)
  are out of date - a change will be submitted (Jano, 9 Oct 2026). Don't use them for areas or layouts.
- Before claiming something doesn't exist, research it, and say what was searched.
- Branding: the Ziegermill visual identity (`LOGO\ZIEGERMILL_IDENTITA_V3.pdf`).
  - Name: "Ziegermill".
  - Never "Mlyn Matadorka" (Jano, 10 Oct): that is only the SPV's (Mlyn Matadorka s.r.o.) name, not the brand.
    Place names stay, e.g. view "Matadorka", "Kúpalisko Matadorka".
  - Colours: Orange `#ffa62b`, Dark `#544740`, Neutral `#d6d9c7`, Blue `#3091b2`, Accent Blue `#04318c`.
  - Fonts: PP Frama (paid) or Google Sans (regular/medium/bold, files in `LOGO\Google_Sans`).
- Public pages are in Slovak.
- Commit or push only when Jano asks. Work on branch `atelier-walkthrough`; `main` is production.

## Website

- Next.js 16.1.6 (App Router), React 19, Tailwind 4, framer-motion, mapbox-gl.
- Supabase holds the flats (`units` table). Keys are in `.env.local`, never print them; see `.env.local.example`.
  - The project ref is `ghensbmcgjhxarcdwasq`. The claude.ai Supabase connector is authorised for the ProfitPort
    organization only and must stay so (Jano). For Zieger Mill there is a second, project-scoped connection
    `supabase-zieger` (`.mcp.json` + `.claude/settings.local.json`, local only, excluded from git; added 8 Oct 2026 with
    Jano's OK). It signs in once in the browser - choose the Zieger Mill organization.
  - Admin login is home-made, not Supabase Auth: `admin_users.password_hash`, the `verify_admin_login` function,
    `admin_sessions` tokens in a cookie; server code uses the service-role key (`app/lib/admin-auth.ts`).
  - 8 Oct 2026: the admin tables were readable AND writable with the public key, and the admin functions callable ->
    `20261008180000_lock_admin_tables.sql` + `20261009090000_cleanup_open_policies.sql`, applied 9 Oct.
  - Price list: `20261008180100_price_list_structure.sql` (new `units` columns: kind, rooms_count, view_type,
    gallery_area, total_area, area_with_podium, price_list, is_public, sort_order, selector_id, walkthrough_url; table
    `site_settings`; public read only; unit_type = atelier | flat, the list's Typ in `layout`; price_per_m2 is generated). Data: `python scripts\import_cennik.py "<cennik>.xlsx"` writes
    `supabase/seed/cennik.sql` (upsert of all units; keeps status and walkthrough_url). Units are A01-A34 (ateliers) and
    B01-B03 (flats, named "Byt 01"...); price_per_m2 = price / total_area ("Spolu").
- Git remote: `janskacel-slovakia/ziegermill-sales`. Vercel project `ziegermill-sales`.
- Pages:
  - `/` is the teaser. Its hero button "Ponuka priestorov" links the 3D selector `/walk/selector/index.html`.
  - `/cennik` is the price list. It still uses `public/selector.png` as the building picture.
  - `/mapper`.
  - `/admin`: the sales CRM (`/api/admin/*`, login), see below.
- Sales CRM in `/admin` (9 Oct 2026, Jano: "kind of CRM tool for real estate project"):
  - Migration `20261009120000_crm.sql`, applied as "crm". Data: `supabase/seed/parking.sql`.
  - Roles in `admin_users.role`:
    - `admin` (Jano) can do everything.
    - `agent` (the real estate agent) can change unit and parking status, create clients and deals, move deal
      stages, and upload templates and documents. Prices, areas, web visibility and users are admin only, so a
      discount is the admin's. The server enforces this (`requireUser`, `allowFields` in `app/lib/admin-auth.ts`),
      not the UI.
  - Tabs: Obchody, Jednotky, Parkovanie, Klienti (+ the website's `leads`), Šablóny zmlúv, Používatelia (admin), Môj účet.
  - Deals (`deals`, `deal_customers`, `deal_parking`): one unit plus clients plus parking.
    - Stages: interest → offer → reserved (RZ) → future_contract (ZOBZ) → purchase_contract (KZ) → sold, or cancelled.
      Jano, 9 Oct: a signed KZ is a sale, so the unit and its parking become sold from KZ on. The last stage `sold` is
      shown as "Odovzdané" (registered in the land register and handed over).
    - From `reserved` on, the deal holds the unit and its parking: `syncHoldings` (`app/lib/crm.ts`) sets them
      reserved/sold and frees them on cancel. A partial unique index allows one holder per unit.
    - Reservation runs 30 days by default; late ones get ⚠.
  - Parking (`parking_spaces`):
    - G01–G42 = the garage numbers in tender E.1.
    - E01–E24 are outdoor spaces from the site plan, which has no numbers. They run north street W→E (E10 accessible),
      then the west side N→S, then the south road's parallel spaces W→E.
    - Outlines are drawn on `public/parking/garaz.png` / `exterier.jpg`. Regenerate with
      `python scripts\parking_from_pdf.py` (PyMuPDF).
    - Prices are empty until Jano sets them; the parking list has a bulk price.
    - The public may read the plain columns (not notes or deals).
  - Documents live in the private Storage bucket `crm`. The browser uploads with a signed URL (`/api/admin/files`),
    which avoids Vercel's 4.5 MB request limit.
    - `doc_templates`: the generic drafts, versioned; the newest version of a kind + title is current.
    - `deal_documents`: per client. "Pridať platné šablóny" copies the current templates, the agent uploads the
      client-specific edit ("upravené pre klienta"), then the signed scan.
  - Prehľad (dashboard, the first tab; `app/admin/_ui/Dashboard.tsx`, `/api/admin/dashboard`):
    - A waterfall from 0 through Voľné (list prices) → Rezervácie → ZOBZ → KZ / predané (KZ + Odovzdané merged) to the forecast revenue
      (order set by Jano, 9 Oct),
      plus a 100 % bar and a table.
    - A unit counts at its holding deal's price plus its parking. Without a deal, a unit's hand-set status counts.
      Parking without a price is only counted (none had a price on 9 Oct).
    - The agent's commission comes from Nidal's offer (`Downloads\Cenova_ponuka_Zieger_Mill_Nidal2.pdf`): 1.25 %, or
      1.5 % for complicated cases, plus claims 0.25 %, all excl. VAT; marketing 2,500–5,000 €/month.
      - The deal's `commission_rate` stores the choice: null = standard. The agent picks it per deal (Jano, 9 Oct);
        the server accepts only the two rates in `crm_settings`.
      - Earned from `commission_due_stage` (default KZ); in process = the stages before it; potential = the free stock.
      - Base: price with VAT (`commission_base` gross). Still to confirm against the signed contract with Nidal.
    - Profit is admin only: the server leaves it out for agents.
      - Revenue excl. VAT (`vat_rate` 23 %, to confirm with the accountant) − costs − commission − claims − marketing.
      - Margin, contracted / secured excl. VAT, and how much is still to be sold to cover the costs.
      - Costs = `crm_settings.costs_total` until Jano's cost budget tracking exists; then it should feed this.
    - Settings: the server-only table `crm_settings` (`admin_only` rows hidden from agents), edited under Prehľad →
      Nastavenia. Migration `20261009170000_crm_dashboard.sql`.
  - Everything is logged in `activity_log`. Birth numbers and IBANs are logged as changed without their values.
  - Look (9 Oct, Jano: "everywhere use Zieger Mill branding"):
    - Google Sans via `next/font/google` in `app/admin/layout.tsx`.
    - Brand colours as Tailwind tokens in `globals.css` (`zm-orange`, `zm-blue`, `zm-accent`, `zm-dark`,
      `zm-neutral`, `zm-ink`, `zm-muted`, `zm-paper`, `zm-line`).
    - `/logo.svg` (`Logo`) and the bar motif (`Bars`); header Dark, login Blue, main buttons Orange.
    - Inputs set their text colour explicitly. With a dark system theme, `globals.css` makes `--foreground`
      #ededed, and that had made the typed text pale.
    - After editing `globals.css` `@theme`, the dev server kept serving the old CSS until `.next` was deleted.
  - Login page = `/admin`. Its tabs are Prihlásenie, Registrácia and Zabudnuté heslo (`app/admin/_ui/Login.tsx`).
    "Zapamätať si ma" keeps the login for 30 days; without it, the login ends when the browser closes (max 12 h).
    Jano logs in as `jan.skacel@gmail.com` (admin). Logins are lowercased.
    - Registration (`/api/admin/register`) creates an inactive agent account (`requested_at`). It appears under
      Používatelia → "Čakajúce registrácie": Schváliť (agent or admin) / Zamietnuť.
    - Forgot password (`/api/admin/password-reset`) emails a one-time link `/admin/reset?token=` that is valid
      1 h. Only its sha256 is stored, in `password_resets`; at most 3 per hour. Setting a new password ends all
      sessions. Migration `20261009150000_admin_register_reset.sql`.
    - Email (`app/lib/mail.ts`) needs env vars: `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` or `RESEND_API_KEY`,
      plus `MAIL_FROM`, and `SITE_URL` for the links.
      - Until they are set, production answers "obnova hesla emailom zatiaľ nie je zapnutá" (the admin sets a new
        password in Používatelia), and development prints the email to the dev-server log.
  - Local testing: `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (Jano, 9 Oct).
    - Tested 9 Oct with a temporary admin and agent: registration → approval, role limits, deal → reservation
      holding unit + parking, documents, reset link.
    - Leftovers to delete: `supabase/run_cleanup_test.sql` (test admin disabled, hidden unit TEST1).
  - Not built yet:
    - filling the templates with the client's data (needs final templates with placeholders);
    - email sending (a mail service; the sender address is in `admin_users.email`, see Open items);
    - a reservation-expiry reminder.
- Architect review `/review` (19 Oct 2026, Jano: the architect "can open the floor plans with comments and when he clicks the
  number it will open on new tab 3D model on that particular place ... reply ... no complicated login"). For Juraj (Tesák).
  - Page: `app/review/page.tsx`. It shows the tender sheets with the Studio's numbered points. A point shows its still, its text,
    the thread, a status and a reply box (photos: paste or upload). "Otvoriť v 3D" opens the published walkthrough with
    walks-studio's `?nv=` link (`app/lib/review.ts` `walkUrl`).
  - Statuses: open → answered (architect) → agreed → done. The architect may set answered / agreed; Jano may set any.
  - Role `architect` (migration `20261019120000_architect_review.sql`): only `/api/review/*`. `requireUser()` refuses it
    everywhere in `/api/admin`; `requireReviewer()` lets in admin (`admin_token`) or architect (`review_token`).
  - Personal link: `/review#k=<96 hex>`, valid 90 days, no password.
    - The token is in the fragment, so it never reaches a server log. The page posts it to `/api/review/login`, which starts a
      session in cookie `review_token` (SameSite Lax).
    - Jano issues, copies or revokes it in Používatelia → the architect's row → "Osobný odkaz" (`/api/admin/users/[id]/link`).
  - Data: `review_points` (id = the Studio's point id), `review_messages` (by = user | claude | architect, `studio_key` for
    entries made in the Studio), `review_links`, private bucket `review` (stills/, sheets/, photos/).
  - Emails go through `notify()` only once mail is configured. They never carry the link.
  - Studio sync: `flats\_architect\review_sync.py`, two-way, key `REVIEW_SYNC_KEY` (`.env.local` and `flats\.review.env`;
    Vercel needs it too), endpoints `/api/review/sync` and `/sync/upload`.
    - Up: the points and their views and stills. Down: replies and statuses into `notes.json` (`thread`, `status`,
      `status_at`, `photos` in `_architect\photos\`). An architect reply on a point taken from a Studio note goes into
      that note's thread too.
  - Views: `flats\_architect\review_views.py` → `review_views.json`. A linked Studio note ("BYT 01 #45") gives the
    view; otherwise the walk grid does (camera 1.5-4 m away, clear line).
  - Stills: `review_stills.mjs [nv]` → `stills\` (headless Edge on `_export`).
  - Hall B's points (20-22) open the 3D selector: there is no published exterior view.
  - Tested 19 Oct with temporary users (zz-test-review-admin, zz-test-architect): now blocked, their messages hidden.
    To delete: `supabase/run_cleanup_review_test.sql`.
- `/api/units` is the public JSON of the units: `id, name, unit_type, floor_number, rooms, interior_area, exterior_area,
  exterior_type, orientation, price, price_per_m2, status (available|reserved|sold)`: since 9 Oct the 37 real units
  (A01-A34, B01-B03); the old placeholders 2A-6B are hidden (is_public false, status unavailable).
- Static 3D pages under `public/walk/` must be linked with the full `.../index.html` path, because Next.js does not
  serve `index.html` for a folder. Use plain `<a>` links, not `next/link`.
- Node.js 24 LTS is installed (`C:\Program Files\nodejs`). Use pnpm: `pnpm-lock.yaml` is the current lockfile,
  `package-lock.json` is stale (no framer-motion), so `npm ci` fails. pnpm isn't installed globally; run it via npx:
  `npx pnpm@10 install --frozen-lockfile`, `npx pnpm@10 dev`, `npx pnpm@10 run build`. The dev server is also in
  `.claude/launch.json` ("web", port 3000).
- Dotfiles that came through the Linux file bridge can carry the Windows "hidden" flag, and Node then fails with EPERM
  when it overwrites them (seen in `node_modules\.pnpm-workspace-state-v1.json` and `.next\cache\.tsbuildinfo`).
  Clear the flag or delete the cache file.
- Viewed through the Linux file bridge, git shows every file as a mode change (644 -> 755). That is noise from the
  bridge, not a real change. On Windows `git status` is clean.

## Publishing the 3D to the site

```
python scripts\update_3d.py              # all walkthroughs + selector from flats\_export
python scripts\update_3d.py a32 selector # only these
```

The script mirrors `flats\_export\<name>\` into `public\walk\<name>\` and adds a back button. On the walkthroughs it
is top left, "Späť na výber priestorov", to the selector (Jano, 9 Oct). On the selector it is top right, "Späť na web",
to `/`. `--patch-only` updates the buttons already in `public\walk` without copying anything. Then commit and deploy.
Size is about 14 MB per walkthrough and 1 MB for the selector.

- Language (Jano, 10 Oct): the home page's "Ponuka priestorov" opens the selector with `?lang=sk|en|de`, the visitor's
  language. The selector shows its texts in that language (`T` in `flats\selector\index.html`; model names such as
  "Ateliér 32" become "Studio 32" / "Atelier 32") and passes `?lang=` on to the walkthroughs. The walkthroughs read it
  themselves (walker.html, once re-exported). Both back buttons keep `location.search` and translate their own label.
  The home page takes `?lang=` over its IP-based guess.

- 13 Oct: **flat bakes now go to Cloudflare R2, not git.** A flat line with "After bake commit & push" is exported
  (`export_web.py`) and uploaded with `r2publish.py <flat>` (bakepanel `_r2_publish`, in `flats\_publish\.venv`) to
  `3d.ziegermill.sk/walk/<flat>/`, which also refreshes the selector's `walks.json`. The selector's light
  (`selector-bake`) goes the same way. The git route below (sitepublish.py) is now used only for an exterior target that the
  website repo carries, and there is none today. Needs one Studio restart to take effect.
- 14 Oct: `r2publish.py` also puts `plates.json` next to every walkthrough (the TVs' and door plates' price, areas, rooms,
  orientation, levels; the Studio serves the same live as `/api/plates` from `cennik.sql`). Before, production's TVs showed
  only the logo and number. After a new price list, run `python flats\r2publish.py --all` (only plates.json changes).
- From the Studio (9 Oct, Jano): each line of the bake queue window has "After bake commit & push".
  - When a line finishes with it ticked, `bakepanel.py` publishes it. The same happens when it is ticked afterwards,
    or Retried. Lines waiting at the same time go up in one commit.
  - For a flat bake or brightness run, the Studio first makes the export (`export_web.py`). `run_pipeline.ps1` no
    longer exports: `export_after_bake` stays off.
  - Then `flats\sitepublish.py` runs in the Studio's own checkout of this repo: a git worktree at
    `flats\_publish\site`, detached and reset to `origin/atelier-walkthrough` every time. It never touches this
    folder's uncommitted or unpushed work.
  - The publish step:
    - runs `update_3d.py <flat>` (using this repo's copy of the script), or mirrors `flats\exterior\<target>\` to
      `public\walk\exterior\<target>\` (no page uses those yet);
    - commits as Jan Skacel (`-c user.name/email`, no git config change) and pushes to `atelier-walkthrough`;
    - git never prompts. A missing GitHub login comes back as status "login": the window says "GitHub login missing
      on this computer - not pushed" and offers Retry / Retry all, with no new bake.
  - The checkbox is labelled "After bake commit & push" (Jano, 9 Oct: it is the commit and push; Vercel then builds).
  - The website is **https://ziegermill.vercel.app**. That is Jano's alias (made 6 Oct) in project
    `ziegermill-sales`, and Vercel moves it to each new build of `atelier-walkthrough`. It is not listed under the
    project's domains (it was set as an alias). The branch's own long address is
    `ziegermill-sales-git-atelie-e0f401-janskacel-slovakias-projects.vercel.app`. Production (`main`) is never
    touched; `ziegermill-sales.vercel.app` gives 404.
  - Log: `flats\_publish\log.txt`. The lines and their upload results are in `flats\studio_jobs.json`.
  - The "when the bakes finish" countdown waits for the uploads.
  - By hand: `python flats\sitepublish.py flat=a32 [exterior=walk] [test]` (test = commit without pushing).
    It publishes the current export (make it first with `export_web.py flat=X`).
  - Because the Studio pushes on top of GitHub's branch, this folder's local branch falls behind: rebase or merge
    before pushing from here.
  - 9 Oct: this notebook has no GitHub login stored (Git Credential Manager). The night's three uploads (a32, a25,
    byt01) failed for that reason. Jano signs in once with `git credential-manager github login`; never handle
    credentials for him.
- `scripts/update-walks.sh` is the old bash/rsync version from the Optiplex.
- `_export/` here (untracked) is the old copy from the Optiplex. Nothing uses it any more, and it can be deleted.

## Blender pipeline (`flats\`)

**Since 20 Oct 2026 Zieger Mill runs in the common Walks Studio** (Jano: "go ahead with both switches"; plan
side-session-notes\local_1029c5d2-...\walks-engine-plan.md):
- The Studio program (bakepanel.py, walker.html, studio.html, bake_flat.py, post_flat.py, build_flat.py, build_ifc_flat.py,
  furnish_flat.py, flatlib.py, flatfurn.py, export_web.py, run_pipeline.ps1 ...) lives ONLY in
  `C:\Users\PC1\Documents\walks_engine` (local git, owned by the walks-engine session; README.md, CHANGES.md there). Engine
  changes go to that session; it makes them once for every project (Mudroňova runs in the same Studio). Where this file
  below names `flats\<engine file>`, read `walks_engine\<engine file>`.
- `blender_scene\` is the project folder: `Zieger Mill.walks` (the project file: port 8790, brand, features, paths,
  publish), `hooks.py` (publishing: r2publish.py / sitepublish.py as before), `brand\` (Google Sans + the logo for the TV
  screens and door plates). The flats, notes, params, recipes, bakes and exports stay in `flats\` (output_dir flats).
- ZM's old engine copies are in `flats\_engine_old\` (rollback only - never run or import them). `studio\plans\` is
  now `flats\_plans\`. The build_ / furnish_ / pano_ wrappers run the engine's recipes (`ENGINE = WALKS_ENGINE or
  walks_engine`); the standalone furnish_<flat>.py start with the engine's bootstrap; the gen_*.py write wrappers that way.
- Start: `blender_scene\Studio.cmd` or `Studio app.cmd` (one Studio program for both projects, each on its own port -
  8790 Zieger Mill, 8791 Mudroňova - with ONE bake queue for the computer; the other project's lines show greyed).
- Scripts started by hand find the project upwards from where they run (the .walks file) or from `WALKS_PROJECT`; trial
  builds: `WALKS_BUILD_OUT` / `WALKS_FURN_OUT` (the old `ZM_BUILD_OUT` / `ZM_FURN_OUT` still work).
- The exterior's scripts (bake_exterior.py, extsurround.py, extbake.py, ext_*.py, panorama_build.py) and the publishing
  scripts stay in `flats\` (they are Zieger Mill's); the selector session's files were not touched.

Each flat has:

- `<flat>_params.py`: geometry, doors, devices etc. Driven by the notes.
- `build_<flat>.py`: building shell. A32 and A25 use `build_flat.py`; BYT 01 uses `build_ifc_flat.py`, taken whole
  from the IFC.
- `furnish_<flat>.py`: furniture. Shared code is in `furnish_flat.py`, with `flatfurn.py` (furniture library) and
  `flatmats.py` (materials).
- Blend files: `<flat>\<flat>_arch.blend` and `<flat>\<flat>_furn.blend`.
- `bake_flat.py` and `post_flat.py` (Jano only), then `export_web.py`.

Running things:

- `run_flat.ps1 -flat X -what build|furn|all` does the model steps without baking.
- `run_pipeline.ps1 -flat X` runs build → furnish → bake → post → export. This is Jano's bake; started from the studio.
- `export_web.py flat=X` writes `flats\_export\X\` and `X_walk.zip`. The page template is `flats\studio\walker.html`
  (mobile controls: left thumb walks, right half looks). The A32 ⇄ A25 switch top right is off since 13 Oct
  (Jano: remove it from production; `export_web.py` `SWITCH = []`).
- Previews (no bake): `preview_flat.py -- flat=X quality=quick views=<json> pv=<dir>`.
- Live gloss (14 Oct, Jano: wood "like from 2005 video game", "no reflective surfaces"; then "make gloss default ... no
  button"): `gloss_flat.py` (blender -b <flat>\bake\bake_scene.blend --python gloss_flat.py -- flat=X; reads, never saves;
  ~8 min on CPU, less on the GPU) writes `<flat>\web\gloss\`: gloss.glb (the B_<group> meshes + normals, split by gloss class
  from material names: floor, wood, satin, ceramic, tile, blackgloss, screen, metal, mirror, leather, art, plastic, matte),
  probe_<i>.jpg (360° renders from flat.json's places + EXTRA rooms, box-projected), the wood's normal / roughness / diffuse
  maps at 1K, mirrors' rectangles, gloss.json (per class F0 / roughness / strength / detail - editable without Blender).
  walker.html loads gloss\gloss_glb.wasm instead of flat_glb.wasm when gloss\gloss.json exists (no button): baked picture +
  Fresnel x probe, wood grain detail + relief, glass and the TV picture reflect, mirrors are three.js Reflectors.
  A gloss belongs to one bake: bakepanel `gloss_stale` (web\flat.glb newer) -> 404 for gloss\ (plain bake), `gloss_soon` after
  each bake, `gloss_run` before a publish; export_web.py copies gloss\ only when fresh. A32 done; other flats: run it once.
  14 Oct evening: walker.html reads the baked picture with a B-spline (bicubic) filter where a light-map pixel is bigger
  than a screen pixel (`smoothBake`; Jano: "low resolution squares" close up); room probes blend over the last 30 cm of
  overlapping boxes, smaller rooms first (A32 note 167: a hard line where the entrance's box ended on the worktop). In the
  Studio `window.__walk` = { player, camera, smooth (gSmooth 0 = plain read, for comparing), scene }.
- Notes deleted in the Studio stay on disk as `{"deleted": true}` tombstones: skip them when scanning `<flat>\notes\`.
- Website common areas (15 Oct, Jano: "make published version ... common spaces walkable"): export_web.py writes a flat's
  entrance door into its flat.json as `exit` (bakepanel.exits), so on the website that door opens
  `../common/index.html?at=<flat>`; the common export carries `plates.json` (bakepanel.plates, price list at export time -
  re-export common after price changes); door links use `../<flat>/index.html` (R2 has no folder index: `/walk/a32/` is 404).
  The selector's way in (a button to /walk/common/index.html) is the selector session's.
- Trial builds (no bake, nothing real overwritten): `ZM_BUILD_OUT=<dir>` for `build_<flat>.py`, `ZM_FURN_OUT=<dir>` for
  `furnish_<flat>.py`; the bake pipeline rebuilds and refurnishes anyway, so params / script changes show at the next bake.
- Added 13 Oct (notes rounds): `flatmezz.build_L` - an L stair with winders for the IFC ateliers' timber mezzanines
  (MEZZ["stair"]["L"] = dict(low_n, low_going, winders); A29), no guard; `furnish_ifc_min.py` reads `WARDROBES` /
  `BEDS` from the params (A29); BYT 01's params have `FANS`, `ACS`, `HALL_TILES`, a 5th "sw2" (double switch) on
  `SWITCHES`; A32-only overrides in `a32_devices.py` (`ACS`, `VENT_AT`, `FANS`, `TOWEL_RAILS`, `PLANTS_AT`, `CEIL_BOXES` (lowered ceiling / bulkheads hiding the services' ducts, note 169),
`WARDROBE_H`) read by `furnish_flat.py`. Services geometry that needs a ceiling or lining must have it built in the flat too.
- Formwork concrete panels (A01 note 12, 15 Oct: "keep always the same size as in A32. In all flats"): 1.15 x 2.75 m everywhere,
  `flatmats.BOARD_PH` via `FM.board_ph(P)` (was half the storey: 1.30 m on 2NP/3NP, 2.575 on 4NP/5NP; A32-A34, BYT unchanged).
  Every build / furnish script - also a standalone `furnish_<flat>.py` - passes `FM.board_ph(P)`, never `(ZC - Z0) / 2`. The
  common areas' 1.465 m (build_ifc_flat.py CONC) is not a flat's and was left.
- A01 round 1 (15 Oct): `furnish_a01.py` is standalone (as A11 / A34); a two-seat sofa from S01 (cut + mirrored, `sofa2_prep`),
  an oak slat floor-to-ceiling room separator with planters (built in the script).
- A02 round 1 (17 Oct, notes 1-4): `furnish_a02.py` is standalone (was furnish_ifc_min). A33's east wall (tall units, grey counter, TV sideboard + TV, planters) is built as furnish_flat.py builds A32's on u 0 and then mirrored at object level about the centre line (as flatmirror.py; bake flips negative-determinant normals) - A02's east wall has A33's 44 cm corner pier, so A33's v values apply as they are. Bed on the bathroom block's south face, A01's sofa2 + coffee table on the west wall facing the TV, A01's LIGHTS mirrored (u -> 4.73 - u, ADJ_SPOTS). a02_params TV = None.
- 17 Oct evening notes: A01 43-49 (KITCHEN_REST_AT window + KITCHEN_REST_KIND door; kitchen2 wall dict single_to = one wall-cabinet door up to that width; TV_UNIT sideboard v range; PLANTS only P02 on the south pier; SEP_PLANT_ON_SOIL), A02 5 (SEPARATOR = (free end u, wall end u, v), mirrored when the wall is west), A10 11 (DESK in the south room corner), A11 8 (SOFA + COFFEE as A01), A32 176/181 (mep_model: ETA4 gone, ETA3 120 m3/h as a wall grille over bathroom 1 door, COWL over the riser shaft COWL_AT, EHA straight east; a32_devices: hall bulkhead removed, VENT_MORE grilles drawn by furnish_flat). A01 44 open: the swapped 3.01 m sofa does not fit between the separator and the south wall (2.60 m).
- Live sun (17 Oct, Jano: "try option #1 ... keep option to switch back ... alternative bake per flat + sun gizmo. Let's try on A32"): `flats\sunfree_bake.py` re-bakes ONLY the irradiance pass of `<flat>\bake\bake_scene.blend` with the sun hidden (fresh copies of the original materials - bake_flat's alpha pass leaves furn/plants wired to emission and sheer opaque), into `<flat>\bake_sunfree\`, never saving over the bake scene; `sunfree_post.py` denoises it like post_flat and writes `<flat>\web\sunfree\` (sf_<g>_lin.jpg log-encoded linear light x colour + emission, sf_<g>_alb.jpg, sf_<g>_nrm.jpg, sunfree.json with bounce_ref = median(normal irr / sun-free irr) - 1 and glb_bytes). Walker (Studio only): Sun button -> sun-path dome gizmo with a calendar ring round it (Jano: no half-year switch): drag the ring = the day (Dec wraps to Jan), drag in the dome = the time (the sun slides along that day's arc), wheel = the day, Baked light / Live sun; live = sun-free light toned in-page (agx_lut) + direct sun strength x colour / pi (measured: the bake's light is strength x cos / pi) with a 4096 shadow map + bounce scaled by the flat's glass area the sun reaches vs the baked sun. The sun is also in the sky (Live sun only): a disc + halo sprite 250 m out along the sun (inside the sky sphere, so walls, frames and nearby buildings hide it), and a screen-blended glare quad whose strength = the share of the disc the eye sees (a 32 px magenta probe render 12x a second; sheer curtains dim it) x how straight you look at it; the same quad draws a lens flare (6 ghosts on the sun-centre line, rainbow ring, starburst, streak) from ~50 deg off the sun. Default (Jano 17 Oct: "use it as a default for all flats"): the walker opens in Live sun once the flat is loaded when its sun-free bake is current (?light=baked forces the bake). Since 17 Oct evening (Jano: "any new bake I do in the studio from now on will automatically be sun-free") run_pipeline.ps1 runs SunFree after post: sunfree_bake.py auto=1 progress=1 (the groups this bake changed; reused groups keep their sun-free map when its source sig matches) + sunfree_post.py, steps sunfree.<g> / sunfree.post in the bake panel (flatprogress.plan_stages), a failure only logged; off with studio_prefs.json sunfree_after_bake false. The queue was stopped (only A03 and A32 have sun-free bakes from before). 19 Oct (Jano: "don't bake in background. I will bake on my own in the studio"): no sunfree_queue.py runs - sun-free maps come only from his Studio bakes. flats\sunfree_queue.py does every flat: one group per Blender run, waiting before each while run_pipeline.ps1 / bake_flat.py / post_flat.py run, resumes groups already baked from the current bake, then sunfree_post; status _sunfree_queue.json, log _sunfree_queue.log; runs once through the list (re-run after re-bakes). Live sun is disabled if flat.glb's size changed (re-bake -> re-run both scripts). 18 Oct: (1) the sky HDRI (kloofendal puresky) has its own sun (~48 deg up, fixed direction, E ~4.35 = as strong as the Sun lamp, about half the sky light): every bake had two suns. sunfree_bake.py clips the world environment at 10 (flatlib.sky_without_sun), records sky {dir, E, alt} in sunfree_meta/sunfree.json; the walker splits bounce_ref between the lamp and the sky sun by their lit glass. sunfree_queue.py treats a sunfree.json without sky as stale. (2) Sun panel: no Baked light / Live sun / The baked sun buttons - Live sun is simply on where current; Set as start writes <flat>/web/sunfree/start.json {day, H} via POST /api/sunstart (bakepanel - needs a Studio restart), the walker reads it at load. (3) Live sun + the outside: the street model loading after Live sun replaced the ctx strip's shader (white facade/railing) - loadOutside now clips the baked material (sunOf) and the sun material clips itself (keepMin/keepMax). (4) sofa2_prep: bmesh.ops.mirror keeps the winding, the mirrored half faced inwards (black in the bake) - reverse_faces on the mirror result (A01, A02, A11). Found while building it: in bake_flat.py the groups baked after furn's alpha pass (win, relief, sheer) bake with the furniture glowing white (A32: relief +26 %, sheer +41 %, win +4 %) - reported to Jano, not fixed (his script) - fixed 19 Oct with the sun-off change (bake_flat relinks each material's own shader after the alpha pass).
- Live sun on the website (19 Oct, Jano: "yes, live sun on the website"): sunUI runs on the published walkthroughs too - a round
  Sun button (#sunChip, under Measure; the Studio keeps its toolbar Sun), the panel in the visitor's language (sk/en, ST texts),
  no Set as start, no technical notes; phones (touch) load sf_<g>_*_m.jpg (half size, sunfree_post.py writes them from now on)
  and use a 2048 shadow map with 3x3 PCF (desktop 4096, 5x5); the shadows are drawn again only when the sun moves (the Studio
  also every 3 s). export_web.py copies web\sunfree\ + agx_lut.json only when sunfree.json is from this bake (glb_bytes) and
  has no sun of its own (sky clipped or sun_off) - else the page shows the bake; it warns when a sun-off bake has no sun-free maps.
  On 19 Oct only A11's maps qualify (the others' were made before the sky clip): the rest get Live sun with Jano's next bakes.
  Publishing (re-export + r2publish.py) is Jano's call.
- Studio layers (19 Oct, Jano: "our studio needs turning on/off layers ... We definitely need to be able to turn on/off furniture"):
  walker.html layersUI, Studio only - Layers in the toolbar: Furniture (furn + moved), Plants, Curtains (sheer), Windows and doors
  (win + glass), Outside (ctx + the street model), Services (the x-ray). A hidden part is out of pickables (notes, swap, measure)
  and its earlier visibility is kept (userData.layVis); remembered in localStorage layers.off. Baked shadows of hidden furniture
  stay in the light maps.
- Ported from the Mudroňova Studio (19 Oct, its port_note_mudronova_to_ZM_19oct.md): bakepanel _params cached per params
  file mtime (+ params-warm thread: quick swap / queue clicks); moves keep prev, Undo re-activates it; the walker's moveUI
  starts a piece from its baked move (no jump); gloss_flat.py lod / lm_texel per textured class, 2K colour, class deck, out=;
  the walker's grain detail in colour against the texture blurred to gLod; run_pipeline.ps1 Gloss (gloss_flat.py) as the
  last stage before ExportWeb (flatprogress "gloss"); the live-sun shadow map fitted to SF.box + 25 m (near 80 m up-sun);
  bake_flat.py SMOOTH_BENDS (20 deg, shell + ctx shaded smooth; 0 = off) and post_flat.py stitch_seams() (STITCH_SEAMS = False
  = off; on A32's shell it finds nothing to stitch); flatfurn.load_asset takes thick curves as meshes; furnswap prep flip_z
  (catalog item "prep", passed on by furncat).
- Swap preview (19 Oct, from the Mudroňova Studio): showGhost turns the candidate as furnswap.py does (its own width across, depth
  along; WIDE_CATS quarter turn at 1.3x) - before, a bed only 14.7 % deeper than wide showed turned 90 degrees.
- Bakes without the sun (19 Oct, Jano: "all the bakes from now on are baked without sun. Sun is added later and is realtime based on sun wheel"): bake_flat.py hides the Sun lamp and clips the sky photo's own sun (flatlib.sky_without_sun) unless studio_prefs.json "bake_sun": true, and writes <flat>\bake\bake_sun.json {sun_off, sun (the lamp's dir/strength/colour: the Live sun's reference), sky}; the first sun-off bake reuses no group baked with the sun. run_pipeline.ps1 SunFree then skips sunfree_bake.py (the bake IS the sun-free light) and runs sunfree_post.py straight on <flat>\bake (denoise to *_sfdn.exr, not post_flat's *_bdn4.exr; an old bake_sunfree\sunfree_meta.json is removed so it can't win); flatprogress shows only sunfree.post. With no sunny bake to compare, sunfree.json has sun_off true, bounce_ref null, esky (mean shell sky light over cov & albedo > 0.05) and aroom (2 UW VF + 2 (UW+VF)(ZC-Z0)); the walker's bounce = 0.35 x (strength x k / pi) x lit glass / (aroom x esky) - 0.35 matched to A32's measured bounce (esky 0.0848, aroom 216.9). So the normal web lightmaps (and ?light=baked) are sunless from now on, and the public website (no Live sun yet) shows flats without sun once re-baked/exported. Never bake in the background (Jano 19 Oct): flats get this when he bakes them in the Studio.
- Studio: `Studio.cmd` starts `bakepanel.py` on http://127.0.0.1:8790, local only (it runs hidden; starting
  `Studio.cmd` again replaces an older running copy).
- IFC flats' windows (10 Oct, A34 note 5 "the handle can't be on the glass. And I guess only one side will be openable";
  BYT 01 note 63), in `build_ifc_flat.py` / `flatwin.py`, for every IFC flat:
  - The IFC's own lever handles (its windows' "Kov" parts) are left out; they stood on our new glass.
  - A field crossed by the steel transom (the UPN proxy, < 0.35 m tall) is two fields, to the transom's faces.
  - A lower door field wider than 1.30 m (`flatwin.SPLIT`) is one sash and one fixed light. The sash is on the side
    where the IFC had its lowest lever, hinged at the outer jamb, with the handle by the middle. Upper fields stay fixed.
  - Per window: `SASH_HINGE` [dict(el, hinge "e"|"w"|...)] picks a closed sash's hinge side; `OPEN_SASH` without "us"
    swings only our flatwin sash (BYT 02 notes 31, 32, 38).
  - The door field's threshold runs the IFC frame's full depth (WINS "t"): at 9 cm it left a slot outside every
    balcony door, and the walk grid stopped there (BYT 01 note 62, 10 Oct).
- IFC wall joints (BYT 01 note 64, 10 Oct: blotchy strips Jano took for steel "transpiring"): where an IFC wall's end cap
  lies in another wall's face, the two faces bake as a strip. `IFC_CUT` [(key, axis, "min"|"max", model coord)] moves
  that end into the other wall (plain 12-triangle boxes). BYT 01 has 4, found by scanning its wall boxes for such caps;
  other IFC flats likely have them too.
- Atelier recipe (`build_flat.py` / `furnish_flat.py`, A23-A27, A32, A33), 10 Oct (A33 notes):
  - Kitchen track spots sit 3.5 cm past their lens (they were inside the head and lit nothing).
  - Decor on the TV sideboard stands past the TV's end; the living group (plants, coffee table, rug, ottoman) shifts by
    `DWIN` in the deeper copies; the nook's lights follow `VN2`.
  - Mirrored copies (`MIRROR`: A24, A26, A33) are built in A25's / A32's orientation, but their IFC context isn't
    mirrored: anything matched against the context (the IFC glass dropped from the balcony door) must use `UW - u`.
  - `gen_a32_copies.py` fits A32's hand-placed devices and the nook bathroom (B2_V1, B2_DOOR_V, a partition instead of
    A32's shaft boxes) to A33's walls; it reproduces the A33 files exactly, so change it and rerun, not `a33_params.py`.
- Common areas, 10 Oct (notes 16-22), all via `gen_common.py` (rerun it; it reproduces `common_params.py`):
  - The corridor door plates sit on the leaf (`FLAT_DOORS` moved 7.5 cm in).
  - Stair hall: 5 mm skins over the recessed west-wall piece (the line "still there"), and the 2nd floor's open joint filled.
  - D14's leaf turns whole (`OPEN_DOORS` with the leaf range); before, its stiles stayed standing.
  - The garage (1.PP) is a view-only volume behind door D26, with 8 lights.
  - Lifts and railings are brushed stainless (a node albedo), because the plain light-grey chrome baked as white paint.
  - 15 Oct (round 5, notes 28-35):
    - The flats' wooden front doors (leaf and frame) are in the flats' entrance-door finish `M_I_DoorEntrance`, the dark
      grey of furnish_flat's door unit inside (`build_ifc_flat.py`, common only).
    - Lifts: two leaves with a 10 mm joint per door. `furnish_common.py` adds, from `LIFT_*` in the params, on every stop:
      the rubber joint, a black floor display over each door (-1 basement, 1 ground, 2-6, Google Sans in brand orange) and
      a call panel on the pier between the lifts.
    - View-only volumes (not walked): the ground floor's double-height rooms 1.04 / 1.05 behind the 2nd-floor lobby's
      windows, the ground floor's south half behind them, and the basement corridor -1.04 behind D27.
    - Concrete fills (`FILLS`) close the trenches at window sills and door reveals. `scan_common.py` passes 2-3 write
      `common\patches2.json` (`ZM_SCAN_OUT`); a new pass into patches.json would drop the first pass's patches.
  - 15 Oct (round 6, notes 36-37): the garage is walkable.
    - D26 (double), D27 and D28 (solid) stand open. `OPEN_DOORS` takes a 5th item, the leaf's depth band, for doors
      without glass.
    - The whole basement is in volumes up to -0.30. Over the bands, -1.04 and -1.06 the ceiling is the ground floor slab
      (-0.48); only the courtyard part has the -1.10 slab.
    - Also in: the car ramp's first leg, seen only.
    - A "Garage" place.
  - 15 Oct (round 7, notes 38-42):
    - Only D26's east leaf is open (`how` "double_r"; "double_l" also exists).
    - The garage under SO 01B (-1.07, spaces 28-42) is walked to its stair room. `SO01B_EXTRA` adds the columns and end
      wall the IFC lacks there.
    - Seen only: stair room 2.06 behind D18 and SO 01B's hall to x 42.6 (as far as the IFC roofs it).
    - The roof round the housing is in, walkable through the open D35.
    - `WALK_BOX` x -8.7..70.9, y 0.2..28.9, about 10x the old walk grid.
  - 16 Oct (round 8, notes 44-47):
    - SO 01B's hall is in whole. `SO01B_EXTRA` adds its end wall and a flat roof past x 42.55; the IFC has neither.
    - The garage ramp: the IFC has only the OM01 retaining walls. `RAMP` in the params holds the cross-sections (from those
      walls, T-10.01). `furnish_common.py` builds a 20 cm concrete slab, -3.65 to -0.10, about 20 %, walkable.
    - The tender has no transport or signage part. The garage door DB is not in the IFC.
    - The corridor's three infilled openings are on the architect sheet (point 30).
  - 17 Oct (round 9, notes 48-52):
    - The railings (kind "rail") are black matte paint, `M_C_RailBlackMatte` (gloss: satin). The tender leaves the colour open
      (E.20). The lift doors' boxes take the lift frame's finish (HYDRANT `|43330|` -> `M_C_LiftSteel`), not a railing part's.
      The roof housing's "Ocel - konstrukční" posts are not rails: they keep `M_C_Chrome`.
    - `OPEN_DOORS` "double*": faces spanning the door's middle (the frame head's stop) stay in the frame. Before, a 1.9 m sliver
      stuck out at D21's head.
    - A narrow patch face (4.5 cm, 5 m tall) can bake dark (texels rebuilt from other islands). Cover it with a wide 2 mm skin
      (`SKIN51`, 4th floor west wall).
    - Corridor windows O28 (4NP) / O33 (5NP) run past the slab of the flat's mezzanine over the corridor, leaving an open slot.
      It is on the architect sheet (point 31).
- IFC flats' entrance door (Jano 15 Oct, "Front doors - keep gray"): the `IFC_KEEP` door gets kind `door_ent`, so its
  wooden leaf and frame are `M_I_DoorEntrance` in the shell and the context (`build_ifc_flat.py`).
  - Applies to A01-A22 (not A10), A28-A31, A34.
  - A19: the IFC puts its door (|70635|) a floor too high. `a19_params.py` has `IFC_MOVE` -5.48 m, `IFC_KEEP` and
    `OPENINGS` (the 4th floor wall had no opening, so before that a white wall stood in front of the moved door).
- Architect tab (Jano, 10 Oct: "non-PDF version in the Studio where I can update, add, remove the comments and then when
  final, export it to PDF"): `studio\architect.html` at `/architect`.
  - Every floor plan sheet of the drawing set, cut as in the PDF (`_architect\sheet\*.png` and `pages.json`, made by
    `make_pdf.py pages`), with the points of `_architect\notes.json`.
  - Add point, then click the spot. Drag a pin to move it. Titles and texts are edited in place in the PDF-like panel and
    saved as you type, one change at a time (`/api/architect/notes`). Delete renumbers the rest.
  - Export PDF runs `make_pdf.py` (Python 3.14, the one with pymupdf), so the PDF looks as before. Edits made in Acrobat
    are still read back: by each point's id (`/NM zm:<id>:spot|title|text` on its PDF comments), so renumbering is safe.
- Studio app (Jano, 10 Oct: "go to option 2, but keep current browser version as a backup"). `flats\Studio app.cmd`
  runs `studio_app\studio_app.py`, a window of its own (pywebview 5.4 on Edge WebView2) on the same helper.
  - The browser version, the phone over Tailscale and "Shared version" keep working, also at the same time.
  - It starts the helper as Studio.cmd does (with `--no-browser`). Closing the window stops the helper only if the app
    started it fresh and nothing runs; while a bake, upload or preview runs, it asks first (keep it in the tray, quit, or
    stay).
  - Tray: Open, Reload, Bake queue, Open in the browser, Quit.
  - Reload (10 Oct): F5 / Ctrl+R, and Ctrl+F5 / Ctrl+Shift+R past the cache. pywebview turns WebView2's browser keys off
    outside debug mode; the app turns them back on (`AreBrowserAcceleratorKeysEnabled`). The helper sends `no-store`, so
    a plain reload already picks up changed `studio\*.html`. Reloading never touches the helper or a bake.
  - Notifications from /api/queue: bake done / failed / stopped, website upload done / failed / GitHub login missing,
    the sleep / shutdown countdown.
  - Its own Python: `studio_app\.venv` (Python 3.12, `requirements.txt` pinned, made by `studio_app\setup.cmd`).
    Window data in `studio_app\webview`, a log in `studio_app\app_log.txt`. No Start menu entry, autostart or registry.
  - Layout (Jano, 9 Oct): the big switch top left is **Interior | Exterior**. The UI says "Exterior", not "Exteriér".
    - Interior: the flat picker, then the tabs Walk & notes, Bake (`/bake?part=interior`: the flat's quality,
      progress, previews) and Flats.
    - Exterior: the tabs 3D walk, 3D selector (both `/walk/exterior/?light=walk|selector`) and Bake
      (`/bake?part=exterior`: the exterior card only).
    - The bake queue window is shared by both sides.
    - The status pill follows the side; the "Shared version" link is interior only.
    - Remembered per browser: `studio.side`, `studio.tab.interior`, `studio.tab.exterior`.
  - Walk & notes: the latest bake, with review notes in `flats\<flat>\notes\`, API `/api/notes?flat=X`.
  - Exterior (8 Oct): `studio\exterior.html` at `/walk/exterior/`, a free-fly view of the selector's master model
    (`_export\selector\building.glb`, read only). Its notes are flat `exterior` (`flats\exterior\notes\`, same API and
    format); `pos` = glTF y-up coordinates of building.glb, `cam` = {x, y, z, yaw, pitch}.
    Its light is baked from Exterior → Bake (Jano starts it, as every bake). Two targets (`extbake.py`), each with
    its own quality and brightness:
    - 3D walk: the flats' sun and sky (kloofendal HDRI, SUN_DAY/SUN_HOUR of A32). Round the building it adds
      the street, the neighbours, trees, planting, cars and people (`extsurround.py`). These rebuild the layout of
      `build_scene.py` / `lib_traffic.py` from the same libraries; scene_v1.blend is never opened.
    - 3D selector: an even sky with no sun, small maps, the building alone.
    `bake_exterior.py -- target=walk|selector` writes `flats\exterior\<target>\`:
    - exterior.glb with a second UV set.
    - lm_*.jpg maps. kind "light" is multiplied with the model's colours; kind "colour" (street, neighbours) has the
      colour baked in.
    - trees lit per vertex.
    - beds.jpg: the planting seen from above.
    - sky.jpg.
    - Publishing (13 Oct, Jano: "yes"): extbake.ON_WEBSITE["selector"] = True - a 3D selector line with "After bake commit
      & push" goes to R2 (`r2publish.py selector-bake` -> walk/selector-bake/ on 3d.ziegermill.sk; bakepanel `_r2_publish`),
      not the website repo. r2publish needs boto3: bakepanel runs it with `flats\_publish\.venv\Scripts\python.exe` when that
      exists, else its own Python (which has no boto3 - the publish then fails with that message).
    - The master parts baked are named in bake_exterior.py GROUPS; exterior.json "parts" lists them (13 Oct). A new part
      of zm_master.py's building.glb must be added there, or a page that draws the bake instead of the model (the selector's
      version B) loses it - as HallBWindows, GroundFill and SiteMarks were (Jano, 13 Oct). SiteMarks stays live on purpose
      (paint on asphalt would go as a stacked face).
    - people\ cut-outs.
    - exterior.json.
    Test without baking: `-- dry=1 out=<dir>`, plus `shots=<dir>` for three quick renders.
    A target not baked yet shows the even light (its tab says "not baked"). On its own, the page keeps its light
    button.
    Commit & push for exterior lines: only targets a website page uses (`extbake.ON_WEBSITE`, both False for now).
    Until then the queue line's checkbox is off and greyed out, with the reason (`WHY_NOT`).
    - 9 Oct: the first 3D selector bake went up before this rule, as commit c9adeab (`public/walk/exterior/selector`,
      about 2 MB, unused).
    - Set the target True once the selector page or the published walkthroughs load
      `public/walk/exterior/<target>/`.
    When the selector rebuilds building.glb, the card says the bake is older than the model.
    The Studio's walker shows the 3D walk bake instead of the window panorama:
    - It uses `/api/outside?flat=X` (frame + CTX box).
    - The shared outside is cut away inside the flat and its CTX box. The flat's own ctx is kept only inside that box.
    - It is toned with `agx_lut.json`, using the flat's exposure and shadow lift.
    - The website export does not have it yet.
  - Bake: Interior → Bake has the quality per flat, progress and previews; Exterior → Bake has the exterior card.
    Their start buttons add lines to the bake queue.
  - Flats.
  - Bake queue window (9 Oct, Jano), in `studio.html`, bottom right on every tab; it can be made small.
    - It appears when a bake is started. While it is open, every start button says "Add to queue": Start bake, the
      brightness run, Exterior → Bake. Each line is a flat bake, a brightness run or an exterior target.
    - Lines run one at a time from the top. A flat line reads its quality settings, and an exterior line its target's
      quality, when the line starts.
    - Per line:
      - drag the handle (or press the arrow keys on it) to reorder the waiting lines;
      - "After bake commit & push" (see Publishing; the last choice is the default for new lines);
      - × removes the line. On the running line, × asks once ("Stop"), then stops the bake.
    - At the bottom: "When the bakes finish" (nothing / sleep / hibernate / shut down). It is a 2-minute countdown
      after the last line, waiting for uploads.
    - Close (×, only when nothing waits) clears the finished lines.
    - Pause (10 Oct, Jano: "ok, 1 and 2"), two buttons under the list; "Paused" in the window header and status pill:
      - ⏸ Pause the queue: the running line finishes, and nothing new starts until ▶ Resume (`studio_jobs.json`
        `paused`). "When the bakes finish" waits while lines wait.
      - ⏸ Pause this bake: `queue_pause` suspends the line's whole process tree (`NtSuspendProcess`: run_pipeline.ps1,
        its Blender, any step). The processes are kept on the line as [pid, creation time, name], so Resume works after a
        Studio restart and never resumes a reused pid.
      - While paused, the bake's `progress.json` carries `paused.at`, and the estimates (page, Bake tab, `_pct`) stop
        there. On Resume, the running stages' `start` shifts by the pause (written while still suspended), so the
        learned rates leave the pause out. `took` leaves `paused_total` out.
      - A paused bake keeps its graphics memory. A restart or shutdown loses it, and sleep may too. Its runner keeps
        holding the computer awake (run_pipeline.ps1's own SetThreadExecutionState).
      - Pausing between bake stages, so a bake survives a restart, is for later.
    - Server (`bakepanel.py`):
      - `studio_jobs.json` holds the `items` (id, kind bake|retone|exterior, flat|target, status, publish, pub).
      - Reading: `GET /api/queue`.
      - Changes: `POST /api/queue/add|remove|order|publish|clear`, plus `/api/after` and `/api/after/cancel`.
      - `/api/start`, `/api/stop` and `/api/exterior/start|stop` go through the queue.
      - The old Bake-tab queue card and the export / publish checkboxes are gone.
    - One GPU job at a time: a line waits for previews and for bakes started some other way.
  - Replies to notes are posted with a small script like `_stage28\r19r_reply.py` (PATCH reply + round, status done).
  - Conversations on notes (13 Oct, Jano: "reply to your notes ... when you ask additional questions, or when I disagree"):
    every notes view (walker.html, exterior.html, the live selector's selnotes.js) has Reply under Claude's answer.
    `data.thread` = [{by: "claude" | "user", text, at, round}]; `data.reply` stays Claude's latest answer and is shown
    after the thread while it isn't in it. Jano's reply sets status open. A note whose last entry is by "user" waits for
    an answer: answer with the same PATCH {reply, round, status} - the Studio server keeps the replaced reply in the thread.
  - Note tools, shared (19 Oct, Jano: "architect should be able to reply to my comments - we should implement new notes
    functionality (arrows, lines, pasting pictures, etc.) from Mudronova Session"): `flats\studio\notetools.js` (ES module,
    importmap "zm-notes" -> /studio/notetools.js; export_web.py rewrites it to ./notetools.js and copies the file).
    walker.html and exterior.html build their whole notes UI with `NT.createNotes(host)` (host = camera/picking/go-to-view);
    selnotes.js shows marks, photos and architect replies read only. Format (also for the architect review page /review on
    C:\ZM-WEB, session architect-review): data.marks [{k B.., type pin|arrow|line|poly, pos | a,b | pts, len, area, text, snap,
    reply?}], data.photos [{file <id>_ph<k>.jpg, at, url?}], data.still {file <id>_still.jpg, w, h}, thread[].by 'architect' (+name),
    thread entries' marks/photos lists. Deep links: ?note=<id> (Studio), ?nv=<base64url {v,flat,id,n,text,pos,cam,marks}>
    (anywhere, read only), &still=1 (&w=) -> window.__noteStill + postMessage {zmNoteStill}, saved as data.still in the Studio.
    Also #zmr= / #nv= (the same JSON in the fragment, + label, title), walker ?cam=x,z,feet,yaw,pitch (host.camKeys), and
    window.__walk = {ready, shot(w)} for architect-review's headless stills.
    Each listed note has Copy link (the website ?nv= link). bakepanel: POST /api/note-photo | note-photo-remove | note-still
    (nflat: flats and exterior), GET /note-photo/<flat>/<file> - these need a Studio restart. The marks header row is .mrow
    (timetrack.js puts its picker above the panel's first .row). Interface note for architect-review:
    side-session-notes\local_137a1f48...\walks-studio_note_tools_interface.md. Mudroňova gets every Studio feature too (Jano 19 Oct:
    "both studios should be synchronized"): port note port_note_notetools_from_ZM.md in its notes folder.
  - Time log (18 Oct, Jano: "Can't studio help me tracking where do I spend my time?" - to bill IFC errors and client
    changes when the Studio becomes a service). Local only, nothing is sent anywhere. Needs one Studio restart.
    - Heartbeat: bakepanel adds `studio\timetrack.js` to every page it serves (shell, walker, exterior, architect, bake,
      plans, flats, the live selector; never the published walkthroughs). The top window posts `POST /api/activity`
      {flat | exterior | selector | architect, tab, kind, note} every 30 s while visible + focused + used within 2 min;
      framed pages only tell the top window (no double counting). `timelog.py` appends to `flats\_timelog.jsonl`
      (t, flat, tab, kind, note, cat, client = studio app / browser / phone).
    - Counting: beats < 5 min apart are one session; the gap goes to the earlier beat. Category = the note being written or
      read (focus in a list item, the new-note panel, the highlighted note), else Architect tab = ifc_error, else the tab.
    - Note categories: `data.category` = design (default when missing) | ifc_error | client_change | studio_bug | other.
      Picker in the new-note panel and on each note in walker.html / exterior.html / selnotes.js (only where
      `window.zmCat` exists, i.e. in the Studio). Claude can set it with the same notes PATCH `{category}`; the Time view
      reads categories fresh, so past time moves with a later change. A category PATCH keeps `done_at`.
    - Time tab (interior, `studio\time.html`, `GET /api/time?from&to&est`): per day / week / flat / category, flat ×
      category, notes with the most time, sessions; "IFC errors · evidence" (ifc_error notes with Claude's rounds + the
      architect sheet's points) and "Possibly IFC errors" (uncategorised notes mentioning the IFC / architect, one-click
      category). CSV: `/api/time.csv` (; separated, decimal comma) and `?what=evidence`; in the Studio app's window (no
      downloads) `POST /api/time/export` saves it to Downloads.
    - Estimate (hatched, "estimate" in the CSV) for the time before the first beat: sittings from the notes' created /
      edited / your replies' times (gap ≤ 20 min, +5 min lead, +2 min tail), bake starts only inside a sitting (queued
      bakes start much later than the click), the architect sheet editor's points 10 min each. About 29 h for 4-18 Oct.
  - Furniture swaps (8 Oct): the walker's "Swap" button (studio only). Library `furnlib.py` (thumbnails
    `furnlib\thumbs\` by `furnlib_thumbs.py`); slot id = the furnish's object name (A32_Sofa ...). Requests in
    `flats\<flat>\notes\_swaps.json`; every furnish build applies the active ones (`furnswap.py`, called from
    `furnish_flat.py`) and writes `flats\<flat>\furn_slots.json`. They show in the walkthrough after Jano's bake.
    Trial furnish elsewhere: env `ZM_FURN_OUT=<dir>` (and `ZM_SWAPS=<file>`).
    - 9 Oct, everything we have. The library covers 26 kinds: also desk, nightstand, sideboard, shelving, wardrobe, TV,
      art, books, curtain, hanging plant, dining table, balcony set. The Studio works out a slot's item from its `src`,
      even before the next furnish build.
      - `swap_to=False` items (made to measure) are only what a swap starts from; they are never offered elsewhere.
      - `pick` "~end" matches a name ending.
    - Catalogue, `furncat.py`. The swap panel has the sources Library | Poly Haven | BlendKit free | BlendKit paid,
      with a search.
      - It lists pictures only (`GET /api/furncat`): Poly Haven from `catalog\ph_models.json`; BlendKit live from
        its public search, cached a day in `flats\furnlib\cache\`.
      - Picking a free one downloads it then: Poly Haven 1k .blend into `assets\models\<id>\`, BlendKit's 1K .blend
        into `assets\bk\x<id8>\`. It becomes a library item `phx_…` / `bkx_…` in `flats\furnlib\catalog_items.json`,
        and the next furnish build places it. Log: `flats\furnlib\download_log.txt`.
      - Picking a paid one only records it as "wanted": nothing is bought. Jano may take a ~€10 BlendKit month later;
        then the wanted ones download.
      - Fronts: seats from the backrest, the rest -y.
      - Related (11 Oct, Jano: "I want to see related assets so they can be combined"): BlendKit has no collections in
        its data, but each item carries `author_id`, `tags` and `brand` ("Designer : …" in its description). The Large
        view offers "More by <author>", the brand and a few telling tags.
        - The choice stays on from piece to piece (`author_id:<id>` or the word, added to the search).
        - "All kinds" adds `kind:all`, which `furncat` turns into "no category": the whole set, to look at only. Each
          one is picked in its own piece.
      - Not yet done: a real download plus a furnish trial with a catalogue model.
- Exterior bake light-map unwrap (9 Oct): the first real bakes were 94 % black. The model's loose triangles each became
  an island, and a fixed 3 px gap left them no room. Now it works like `bake_flat.py`: weld at 0.5 mm, smart project,
  pack with all faces selected, and narrow the gap (4, 2, 1, 0.5 px) while the islands keep 85 % of their size. The
  selector building map uses 39 %. Both targets need baking again.
- Exterior bake, second fix (9 Oct, after the 09:34 selector bake): the light is baked from both sides of every face and
  the lighter result is kept. SketchUp's reversed faces (about 1,400 m² on the building) looked into their own wall and
  baked black. The light stage takes twice as long, and the estimates know it. The empty texels between islands are
  filled with the neighbours' light (mask from the normal bake), so the mipmaps no longer pull black seams into edges.
  The Studio's 3D walk / 3D selector view now reloads when its target has a newer bake. Before, it kept showing the old
  bake until a page reload.
  - Not done: faces hidden inside walls, between floors and under objects still take about a third of the building's
    map. Dropping them would give the visible faces about 1.5× more texels.
- Exterior bake, third fix (9 Oct, after the 11:12 selector bake still had black stripes): about 10,000 faces lie
  within 2 mm of another face. Some are back to back (hall B's roof: top and underside in one place), some face the
  same way (reveals flat on frames). Each pair blocks its own light, so both baked black, and the page drew them
  flickering into stripes. `drop_stacked()` keeps the larger face of each pair. Pages draw the exterior double-sided,
  and the light is baked from both sides, so the one left stands for both. Only the bake's own copy changes, never the
  master model. Only a face lying wholly on the other one goes. A first try that also dropped partly covered faces
  left 790 m² of holes in the plaster and the zinc roof. Dry run (selector): 10,144 faces / 656 m² dropped on the
  building, 264 on the site. Sampling the old surface finds no holes beyond the check's own noise (about 13 m² of
  39,000).
- Exterior bake, fourth fix (9 Oct, the 18:21 selector bake still had black stripes): close up, they are hairline
  cracks between facade pieces and half-overlapping faces. Through them the page shows faces no light reaches, which
  bake black. Now texels under 2 % of the map's top light get the 80th percentile of the lit texels, so a crack reads
  as plaster. `exterior.html` makes window panes opaque in the baked views: dark with the sky's reflection (3D walk)
  or a flat grey-blue (3D selector). Otherwise the now-lit inner faces show behind the glass as pale patches. Tested
  on the 18:21 selector and 18:40 walk maps through a test proxy; needs a new bake of both targets.
- Exterior bake, fifth fix (9 Oct, the 18:58 selector bake: streaks on hall B's zinc roof): every m² got the same room
  in the light map, 15 cm a texel, but only 7,300 of the building's 38,400 m² can be seen from outside. The rest is
  floors, partitions and the inside of walls. Before the unwrap, each face is tested with 12 rays a side (glass stops
  them). Only faces that see the open sky are unwrapped and packed; the unseen ones all point at a strip at the map's
  right edge (u > 0.985) that gets the 80th percentile of the lit light. Dry run: about 11 cm a texel at 2048. Selector
  Final now uses 4096 for the building (about 5 cm), and walk Final was 4096 already. Light stage roughly 3× longer for
  selector Final.
- Exterior bake, sixth fix (9 Oct, the 21:04 Best selector bake: roof streaks, grey hairlines). Two causes:
  - A few badly scaled islands squeezed the rest. Every island is now averaged to the same texels per m² before
    packing (`average_islands_scale`). Hall B's roof (RoofB, RoofB_caps) also has its own map, "roof", last in the
    groups; `extbake.py` presets end with its size (selector Final 2048, Best 4096; walk Final 2048).
  - Dry run: building map 37 % used (was 17), roof 35 % (was 4 % on its own). Both about 3 cm a texel.
  - `exterior.html`: logarithmic depth buffer (panels millimetres apart flickered at distance), and `?cam=x,y,z,yaw,pitch`
    to open at a viewpoint (checking spots).
  - Hall B's long facade has no glass or frames in the master model (empty openings, white in even light). That's
    zm_master.py's model, owned by another session, so it isn't changed here.
- Exterior bake: progress writes retry for 2 s (a 3D walk bake died 29 min in when Windows refused to replace
  progress.json while the Studio was reading it). The final folder swap retries for 10 s, then copies the new files
  over the old ones.
- Exterior view: the mouse wheel flies forward and back where you look (Jano, 9 Oct): a notch is half a second at
  the set speed, ×4 with Shift. The speed is set with + / − only.
- Exterior view, Walk or Fly (Jano, 9 Oct): buttons in the speed box, or F. Walk keeps the eyes 1.65 m above what is
  underfoot (street, paving, terrace, roof). It steps up to 0.5 m; walls and glass stop you and you slide along them;
  trees and people don't. Moves go in steps of 20 cm at most. 1.5 m/s, + / − for 0.8–6, Shift ×2.5. "Street level"
  walks, the other views fly. Rays use three-mesh-bvh 0.8.3 (jsdelivr); without it, three.js's own rays (slower).
- Exterior swaps (Jano, 10 Oct: "add swap object functionality also to exterior, e.g. replace cars"). In the 3D walk
  bake's view, Swap → click a car, a street tree or a lamp → pick another one.
  - One shared surroundings model (16 Oct, Jano: "always use same models for all views ... it should move it everywhere"):
    `ext_surround_export.py` builds them exactly as the 3D walk bake does (`extsurround.build(parts=True)`: same seed,
    same swaps) and writes `flats\_export\selector\surround.glb` (Draco, page y-up like building.glb, ~4 MB; top-level
    groups Street, Neighbours, FarBlocks, Trees_street_1, Trees_street_2, Trees_lawn, Lamps, Cars; the trees share one
    mesh per kind, textures <= 1024 px) + `surround.json` (groups, each lamp's lens point, the swaps). The Studio re-runs it
    5 s after every exterior swap change (`bakepanel.surround_soon`). After changing extsurround.py's layout (a note that
    moves a lamp, a tree, a car), run it by hand: `blender -b --factory-startup --python ext_surround_export.py`. The
    selector session loads it in the selector's views (its night view's lamps).
  - The street is the 2025 easements plan's (17 Oct, Jano: "why can't you just draw the cycle path and all the streets
    according to this picture?"). extsurround `street()` draws `flats\_ref\panorama\plan_streets.json` (the selector
    session's trace: road / cycle / walk / grass shapes, model metres, later on top) in `STREET_EXT` (x -64..150, y -31..-12).
    - The road is at the model's level (-0.36, in the model's own `S_asphalt`). Cycle path, sidewalk and grass sit at
      -0.235 / -0.22 / -0.25 with walls down.
    - The plan's gaps are filled: narrow ones (up to 1.2 m) as kerb concrete at -0.21, wide ones as grass at -0.30.
    - Nothing is drawn where the site model has a surface (a BVH of SitePaving / SiteTerrain / GroundFill).
    - Dashed centre lines run on the road (outside the model's road) and on the cycle path.
    - `Plan.section(x)` gives the road, cycle and walk bands at any x. It places the street tree row (between road and
      cycle path), the cars (on the plan road's lanes, turned along it), and the people and cyclists (on the plan's
      sidewalk and cycle path).
    - The old strips (`street_old`) and the street planting bed (`BED_GONE`) are gone. Bed 0 still draws its random
      numbers.
    - `STREET_EXT` goes to surround.json as `street_ext`. The panorama keeps its ground and roads below it there
      (selector session).
    - Anything added to the layout draws its own random numbers, so the existing trees, cars, people and swap slots
      keep their places. The extension's 7 street trees use `Random(1201)`, its bed plants `Random(1202 + bed)`.
    - A far block that reaches the street is cut back after its random draws.
  - The invented neighbours are gone (17 Oct, Jano: "replace the 3D walk's invented neighbours with the real planned
    buildings").
    - extsurround no longer builds the block across the street, the glass tower, the brick block or the background
      blocks. The background blocks are drawn and dropped, so the random layout stays the same. `ZM_EXT_NEIGHBOURS=1`
      brings them back.
    - The panorama's `Planned` and `Buildings_low` stand there instead. exterior.html and walker.html show them only
      when the walk bake's `LM_context` is under 15 m high; an older bake still holds the 106 m tower.
    - surround.glb no longer has the Neighbours and FarBlocks groups.
- Night selector interiors: `flats\interiors_export.py` writes `_export\selector\interiors.glb` and `interiors.json` (16 Oct, Jano: "it
  should look like real interiors, only made much simpler ... stairs, mezzanines, furniture roughly visible").
  - Source: each flat's `<flat>_furn.blend`, read only.
  - What it keeps (17 Oct round, Jano: "this is not rough furniture. This is some nonsense inside"):
    - The shell: merged flat faces. No glass, railing bars, transom boxes (`SKIP_ARCH`), or wall faces that look straight
      at a window pane within 30 cm.
    - Furniture only by `KEEP_PIECES` (bed, sofa, tables, desk, kitchen, island, tall units, stairs, wardrobes,
      bookcases, shelves, TV unit, nightstands, ceiling boxes). Pieces up to 600 triangles stay as they are; a piece of
      4 or more parts becomes one box per part (more than 80 parts: one box); a big one is cut down to about 220
      triangles; anything else becomes a hull.
    - Loose bits under 0.05 m2 go.
  - What it leaves out: windows, context, fittings, lamps, plants, decor, chairs, doors, TVs, curtains, drapes, pieces
    under 45 cm, and anything outside the flat's plan (balconies).
  - Colour: shell triangles are split to 1.8 m or less. The flat's own Lights plus corner shading (14 ray casts per
    vertex, 1.4 m reach) go into COLOR_0, kept under 1.
  - `<flat>_back`: a backstop box round the shell, faces inward, material `M_InteriorBack` (one-sided). The main
    material `M_Interior` is double-sided.
  - The glb has one node per flat (a01..byt03), about 110k triangles, 1.6 MB. The selector session shows it at night,
    scaled by status.
  - Re-run it with `python interiors_export.py` after flats change. It caches per flat in `_export\interiors_cache` by
    the furn.blend's time; `force=1` redoes all.
- Swap size preview (17 Oct, Jano: "when swapping assets, is it possible to visually show their new sizes?").
  - In the walker's Swap panel, the piece shown in the large view or pointed at in the grid appears in the room as a
    blue box at its real size, next to the current piece's oak outline.
  - The box is placed by furnswap's rules: the category's fit, back to the nearer wall or centred, standing or hanging,
    its long side along the current piece's (for a near-square piece, along the nearest wall).
  - A caption gives both sizes and the differences in cm.
  - Sizes come from `furnlib.public()`: the thumbnails' measures (thumbs.json), a downloaded catalogue model's own, or
    the cars' (`CAR_DIMS`). Categories carry align / vert / fit.
  - BlendKit paid download queue (17 Oct, Jano: "if we haven't bought an asset yet, Swap to this button should be
    replaced by something like save to download queue").
    - In the Swap panel, a paid BlendKit model not bought yet (state not `ready`) offers "Save to download queue",
      also on a grid click. It is kept as `wanted` in furnlib\catalog_items.json, and no swap is made.
    - Once queued, the button says "In the download queue · remove" and takes it off again.
    - Endpoint: POST /api/furncat/queue {item, cat, remove}. Queued models download once there is a BlendKit plan;
      then they are swapped to like any other.
  - Swap anchor (17 Oct, Jano: "choose where to lock alignment relative to the original asset").
    - Control: "Keep in place", a 3×3 plan grid (wall side up: back / middle / front × left / middle / right as seen
      from the piece's front) and Floor / Top. The default is the category's rule.
    - Saved with the swap as `anchor` {f, s, v} (POST /api/swaps; `anchor_only` changes the active swap's anchor).
    - furnswap.swap_one places by it. In furnswap terms, left as seen from the front = min along `lv`.
    - furnswap.index records each slot's `front` (model x/y) in furn_slots.json for the page. Until a flat is furnished
      again, the page guesses: the side standing against a wall (a gap under 35 cm) is the back - a bed's head, a
      sofa's back - and the front is the other way. Only a piece free in the room faces by its short side. (17 Oct,
      Jano: "Bed should have top other than it is": the short-side rule took a bed's long side as its front.)
    - A near-square current piece gets the new piece's long side across its front.
  - Swap pins (17 Oct, Jano: "there should be indicator near it, that it's changed, until it's baked").
    - The walker shows a blue ⇄ pin over every piece with an active swap whose state is not `baked`. It's always on,
      in the Studio only. Failed swaps get a red pin.
    - Pointing at a pin shows a tooltip: the swap and its state (saved, in the model, downloading, wanted, failed).
    - The pins are rebuilt on every `/api/furnlib` load.
  - Move furniture, step 1 (17 Oct, Jano: "can we also build moving objects around? ... move around freely - take and
    place"). The walker has a Move button (Studio only) next to Swap.
    - Click a piece: its triangles are lifted out of `lm_furn` / `lm_plants` / `lm_sheer` (smallest piece box per
      triangle, as the swap pick) into a group pivoting at its footprint centre on its floor level. The piece follows
      the pointer on that level; R turns it 90°, Shift+R 15°. A click puts it down and saves it; Esc puts it back.
    - Saved in `notes\_moves.json` (bakepanel `move_save` / `move_cancel`, POST /api/moves and /api/moves/cancel). A
      move is the total turn `rot` (degrees, counter-clockwise from above, about the footprint centre) and shift
      `dx` / `dy` (model) from where the furnish puts the piece. A new move replaces the old one (status
      replaced / cancelled, `tu` = when).
    - furnswap `move_one` applies the moves after the swaps, about the piece's own footprint centre, and records them in
      furn_slots.json "moves".
    - /api/furnlib gives `moves` with their state and `move_base`: per piece, the move in force when the walkthrough was
      baked (what its geometry already shows). The page shows every piece whose wanted move differs from its base,
      moved; a blue ↔ pin marks it until baked.
    - Carrying: the piece follows the pointer on a level plane at the height it was grabbed (clamped to its floor
      +1.6 m).
    - Walls (17 Oct, Jano: "can collide with interior side of the wall", "can't go outside to exterior"): a piece may
      touch and overlap walls. Only its middle must stay over the flat's own floor (`inside`: a shell surface within
      0.6 m below its floor level +0.3). When pointed outside, it stops at the last point still inside (a binary
      search along the move).
    - Saved moves show after a reload: the preview waits until the flat's meshes are in.
  - Move furniture, step 2 (17 Oct): snapping and dimension lines.
    - Hold Ctrl while carrying to snap. The Move panel's "Snap point" grid (the piece from above, back up) chooses
      which part snaps; it is kept in localStorage `move.anchor`.
    - Per axis (its front axis, its side axis): a middle point centres the piece between the nearest things on both
      sides; a side point puts that side flush against the nearest thing.
    - Gaps are measured from its own faces outward (rays at 3 heights). A hit on a piece whose box overlaps the
      carried one is skipped (`castFree`).
    - Along the wall behind it (within 60 cm), window / door edges count as things too (`jambs`: rays into the wall
      every 5 cm at 1.2 m, ±3 m, cached).
    - Blue dimension lines with cm labels show the four gaps while carrying.
    - The piece's front: furn_slots `front` while it was never moved, else the side against a wall is its back (as the
      swap preview).
    - window.__walk.move = the Move module, for console checks.
    - The mouse button locks the pointer for looking around. While it is down, the carried piece does not follow, and
      the click puts it down at the click's own point. (17 Oct: it followed the screen's middle while locked, so a
      plant jumped behind the wall at the click.)
  - Sideways swaps (17 Oct, Jano: "auto-fix the sideways sofa swaps"): in furnswap `swap_one`, a new piece of a
    `WIDE_CATS` kind (sofa, sideboard, desk, tv, shelving, wardrobe) that comes out more than 1.3× deeper than wide is
    turned a quarter. A sofa is then turned by its backrest (`FF.seat_front` along the old front axis), so its back is
    where the old one's was.
- New flatfurn pieces (A01 notes 37–38, 17 Oct):
  - `shower_corner`: a square frameless corner shower. Two 8 mm glass walls, each a fixed pane plus a sliding pane on a
    black top track, meeting at an open corner entry; rain head, mixer, linear drain; floor-level tiled floor. It
    replaces the IFC's plastic quadrant shower.
  - `adjustable_spot`: a gimbal surface spot (canopy, fork, tilted head), for every light outside bathrooms where Jano
    wants adjustable spots.
  - A01 drops its IFC basin, washer and shower (`IFC_DROP` |58504| |58619| |58513|) for a vanity, BYT 01's Midea
    washer (bk xfff4a07c) and `shower_corner`.
- Kitchens: `flatfurn.kitchen2` has a `hob_oven` module (A01 note 21, 17 Oct): the hob over a built-in oven with a
  drawer below; it gets the hob and the hood cabinet like `hob`. A01's kitchen (a01_params `KMODS_N`, `KITCHEN_FILL`)
  has standard 60/80 cabinets, with the remainder to the window as a filler.
- Live gloss: the lifts' doors and frames use `M_C_LiftSteel`, a copy of the railings' `M_C_Chrome` (common note 43, 16 Oct).
  gloss_flat's `liftmetal` class gives them half the railings' "metal" strength (k 0.4).
  The common floor (`M_C_FloorXY`) has its own class, `concfloor`: half the "floor" strength (k 0.7, common note 49, 17 Oct).
  - The Bratislava panorama (16 Oct, the selector session's `panorama_build.py` -> `_export\selector\panorama.glb` +
    `.json` + `panorama_water.png`; Jano: "in all exterior models even during the day with lights turned off ... and in the
    view from the flats"): `exterior.html` and `walker.html` (Studio shared outside) load that same file - far nodes
    (`*_far`) in a scene of their own drawn first with the sky (camera near 200 / far 26000), the near ones in the page's
    scene, by day (dark glass, no lights), `Buildings_low` off (`exterior.html?pano_low=1` shows it; `?pano=0` none), the
    walk bake's made-up far blocks (`LM_far`) hidden. The flats' window panorama (website) gets the city from
    `pano_flat.py` (imports panorama.glb into the Cycles 360, FogExp2-like haze; `ZM_PANO_CITY=0` off, `ZM_PANO_OUT` a
    trial path) - only for flats whose `pano_<flat>.exr` is rendered again (the pipeline renders it on a first bake only).
    The panorama's trees (panorama.json `trees`, ~830 within 550 m): `studio\panotrees.js` (`panoTrees(THREE, trees,
    {detail, prep})`, the selector's instanced crowns / cones / trunks) - imported by exterior.html and walker.html.
  - Slots (`extsurround.py`): `Car_01`–`Car_08` one by one; `Trees_street_1` / `Trees_street_2` (every other street
    tree), `Trees_lawn` (by hall B) and `Lamps` (all lamps), by row.
  - Choices: the walk's own cars (3 bodies × 7 paints, a side-view picture each), its trees and lamp (`furnlib.py`,
    categories car / tree / street_lamp), or BlendKit free / paid (`furncat.py`; cars from its "standard" category,
    not the supercars). No Poly Haven here: its tree files hold several trees, and it has no street lamps.
  - Requests go to `flats\exterior\notes\_swaps.json` (`/api/extswaps`, saved like a flat's). The next 3D walk bake
    puts them in after the random layout, so nothing else moves. The bake then writes `flats\exterior\furn_slots.json`
    (slots, every object's box in page coordinates, the swaps applied).
  - For the 10 Oct 04:25 bake, that file came from `ext_layout.py` (the layout without a bake). Its check found
    every car and lamp box full of that bake's own geometry.
  - A model car: decimated to 30k faces (20 Oct, Jano: "simplify them"; repeated passes until within 10 %), its glass becomes the walk's car glass, and a length outside 2.4–7.5 m is
    scaled to 4.5 m. Its front is guessed along its length; "Turn it round" flips it.
  - A swap that can't be built (not downloaded, fails to load) is reported, and its slot keeps its own item.
- BYT 01 after the developer's visualisations (Jano, 9 Oct; his answers to suggestions 1–20). Pieces in `flatviz.py`;
  `furnish_byt01.py` and `byt01_params.py`.
  - Kitchen: same cabinets and appliances, charcoal base and tall units, white handleless wall cabinets, black
    pull-down mixer (`kitchen2` style `tap='pulldown'`). The island stays oak, with no hob and no stools (Jano: a hob
    on the island is impractical).
  - Wall: the party wall behind the kitchen in white-painted brick to the ceiling, with a grey brick splashback.
    `flatviz.brick` takes the relief from the normal map. Brick panels are built unrotated, because box projection
    reads the object's own axes and a rotated panel showed streaks.
  - Island: a linear black pendant over it; the cone pendants stay over the table.
  - Dining: light stone top on the oak pedestals (`dining_table_oval(top=)`), taupe chairs on oak legs, gypsophila
    and six place settings.
  - Living: cognac leather (Jano's own swap: "Cognac leather sofa, cushions"), leather pouf with throw and tablet,
    bent-glass coffee table with three books, grey wool rug.
  - TV wall: walnut console with a stone top and a soundbar, a tripod speaker. Jano: the TV moved to the living
    room's north wall under the gallery (v 5.05, west of the 6.04 door), as in the visualisations. The sofa faces it
    with its back 1.3 m from the south glass, with the coffee table, rug, pouf and chandelier between them.
  - The cognac sofa keeps 4 of its 9 cushions (Jano: "max 3-4"): furnlib item `keep_pillows=4`,
    `furnswap.keep_pillows`, which keeps the cushions at the two ends.
  - Later the same evening:
    - TV 85" (1.90 × 1.09 m).
    - Upper exterior blinds pulled up: `IFC_TRIM_BELOW` lifts 7 Obj0003 proxies to their top 20 cm. The lower bands
      in front of the gallery slab stay.
    - Stair as A32's: 12 mm plate treads between 12 mm stringers whose tops run 5 cm over the nosings, a slim black
      handrail on the 6.04 wall, `lm_scale` 2.
    - A second, half-drawn sheer at the study window.
    - Oak skirting 60 × 12 mm (`skirting()` in `furnish_byt01.py`): along the floor's open edges wherever a wall
      stands behind them, not at glass, frames, steel or tiles. 76.8 m.
  - Lights and plants: branch chandelier (126 lit discs, the Heracleum look); the pachira in a stone pot at the
    corner window; the tall calathea (bk P03) by the TV in place of a rubber plant.
  - Curtains: full-height sheers on the south piers, one at the study window.
  - Floor: oak chevron (`FLOOR = ("chevron", 0.60, 0.10)`, `flatviz.chevron_floor`; `build_ifc_flat.py` knows it too).
  - Stair: open risers, and, to try, no railing on its open side (IFC_DROP: SR020 |88785| and 48 railing parts;
    `STAIR_TREADS` and `STAIR_Y` in params). Not legal: STN 73 4130 wants a railing, so this is for the look only.
  - The 14 × 14 cm steel column at the stair foot (|91366|) is in the IFC, from floor to roof. Below the gallery it
    sits inside the wall of 6.04 (note 54).
  - Backups of the previous scripts and models are in that session's scratchpad. Previews: `byt01\viz_check`.
    Needs Jano's bake.
- Walkthrough floor plan map (Jano, 9 Oct, Studio and website): `walker.html` bottom left shows the flat's floor plan
  with a pin and a view cone. In a flat with an upper level (ZM more than 1 m above Z0) the mezzanine plan shows when
  you are up there. "Hide" / "Floor plan" is remembered per browser.
  - Data: `flatplan.py` takes the Flats tab plans (`studio\plans`, calibrated in `levels.json`). The Studio serves
    `/walk/<flat>/plan.json` and `plan_<key>.jpg`; `export_web.py` writes them next to `flat.json` (website).
  - The website gets the whole floor's plan image (about 250 KB each, the architect's tender drawing), cropped only on
    screen.
  - Since 11 Oct (Jano: "show always only floor I am on, in case of lofts"; "use generated marketing plans here, the
    outline version, if not available use this as fallback"), `walkplan.py` (Blender, on `<flat>_furn.blend`) makes the
    map's own images per flat: `walkplan_<floor|mezz>.jpg` (~25 KB, the map's box at 60 px/m) and `walkplan.json`.
    - Source: the marketing outline plan (`_marketing\<flat>\plan_<level>_line.png`, region in DXF metres) where there
      is one, else the drawing.
    - The upper level is blanked wherever down-rays from 1 m over the gallery floor reach the lower level first
      (furniture ignored, stairs kept). The blanked area is shrunk by 25 cm, so drawing walls never get bitten.
    - `flatplan.plan_for` (re-read per request) serves these as keys `<flat>_walk_<level>`. When they're missing or older
      than a new marketing plan, it starts `walkplan.py` in the background (`walkplan.lock`, at most every 15 min per
      flat; log `log_walkplan.txt`). The map's box now reaches the nook over the corridor (`VN2`).
  - **Designing services for another flat: follow `flats\_mep_pilot\GUIDELINES.md`** (sources, data model, routing
    rules incl. "nothing in the air" = `mep_model.floating()` 0, per-trade rules, switching / radenie, process, options
    for wiring on concrete). Jano's A32 notes 140-154 shaped it.
  - Services x-ray (11 Oct, Jano: "add the x-ray view with services to the Studio 3D walk"): Studio only. For a flat
    with `flats\_mep_pilot\<flat>_services.glb` (A32 so far; served as `/walk/<flat>/services.glb`), a "Services"
    button in the tools row (key I) ghosts the flat and draws the routes in trade colours, with a filter per trade and
    for fixtures. The trade colours in walker.html copy `mep_model.TRADES`. The note "Rozpočtový pilot, nie projekt.
    Trasy sú schematické." stays.
    - Building risers in every flat's x-ray: `_mep_pilot\make_risers.py` -> `building_risers.glb/.json` (48 risers from
      the tender DXFs' TZB layers, outer sizes from their blocks), model metres, served as `/walk/<flat>/risers.glb` and
      placed by the flat's frame; drawn a darker shade of the trade. "All" switch; "Building risers" checkbox.
      - What they are, from the 2023 building-permit set (DSP): `G:\...\_Scale - esencia\_Konanie\Stavebne povolenie\
        04_Expedícia\E_DOKUMENTÁCIA STAVEBNÝCH OBJEKTOV\SO 01 OBJEKT ZIEGEROV MLYN\` (E01.3 power, E01.4 low voltage,
        E01.5 plumbing ZT-01..08, E01.6 heating UK-01..08; vector PDFs, some DWG). Its flat layout is older: only sizes,
        rules and the collectors are used. Waste 75/110/125 = DN70 kitchen / DN100 WC / DN125 rainwater; the tender's 7
        "voda" risers are 4x heat pump TČ1/TČ2, circulation, hot water, cold water (ZT-04 / UK-04); 10 heating = ÚK.
      - Waste collectors: ZT-02's KG networks (in the ground under 1.NP, not under the 1.PP ceiling), fitted to the
        tender plan (`risers_fit.png`), 1.5 % fall to the west outlet. Water / heating run under the 1.NP ceiling to
        the tender's technical room 1.06.
    - While x-ray is on, the shared outside (street, people, other flats) and the flat's ctx strip are hidden.
    - Neighbouring flats (12 Oct): `_mep_pilot\make_neighbours.py` -> `building_units.json` (units_dxf + rooms_dxf, model
      metres), served as `/walk/<flat>/neighbours.json`; the walker shows units next to this one (shared wall or across the
      corridor; same floor and the floors right above / below): outline, wet rooms (colour key in the panel; no labels in the model since 13 Oct), their `<id>_services.glb` placed
      by their frame. One switch for all, one per flat.
  - Exterior → 3D selector tab: since 13 Oct (Jano: "leave only version B and remove version A") "Live (B)" =
    `/walk/selector/index.html?hybrid=1` (reloads after a new 3D selector bake) and "Baked + notes"; A and the A | B view
    (studio\selcompare.html, now unused) are gone from the tab. Notes in the live view can be edited (Edit) since 13 Oct.
    16 Oct (Jano: "will you put the prototype in the Studio?"): a third choice, "Night" = `/walk/selector/index.html?night=1&demo=1`
    (the selector session's night prototype: no daylight bake, windows lit by status, demo status mix; same notes layer).
    Before (12 Oct): "Live (A)" (default) shows the live selector page `flats\_export\selector\`
    (written by build_selector.py - the selector session's; served read only as `/walk/selector/`), "Baked + notes" the
    baked `/walk/exterior/?light=selector` view with the exterior notes. `/api/units` in the Studio (13 Oct, bakepanel
    `units()`): the website's /api/units read through (60 s), offline cennik.sql in the same shape - the cards show the
    real size, price and status. In the live / A | B view the notes bar sits top right, under the Live (A) | A | B
    switch; the Bake queue stays bottom right but goes small while a flat card is open (not remembered) and the card
    stands above its bar (studio.html adds `html.zmq #card { bottom: 72px }` to the served page).
    - Notes in the live view: bakepanel adds `studio\selnotes.js` to the served index.html (Studio only); it uses the
      page's `window.__selector` hook (scene = building.glb's glTF space, the same as the baked exterior view) and keeps
      the exterior notes (flat "exterior", /api/notes) - one set of notes for both views.
    - "A | B" (12 Oct, Jano: "I want to try that hybrid bake ... side by side"): `studio\selcompare.html`, two selector
      pages with one camera (the side touched leads). B = the selector session's hybrid page (`?hybrid=1`: live sun +
      the 3D selector bake's sky-only light maps, flats\exterior\selector\). Needs a fresh selector bake (Jano starts it).
    - Power cables: lighting circuits (and switch legs) dashed, paler yellow, own filter (`mep_power_light`,
      make_glb.py); sockets / appliances solid.
    - Switching (11 Oct): `_mep_pilot\a32_switching.json` = groups {name, lights, switches}; 1 switch plain (č. 1),
      2 two-way (č. 6), more = intermediate (č. 7), a switch in 2 groups = double (č. 5). Each switch: one cable up the
      wall to the ceiling and across to the nearest light (`mep_model.leg`), cores 1 + per group 1 / 2 travellers ->
      CYKY-O 2x/3x/4x1,5; a double switch's other group gets a CYKY-J 3x1,5 link. Lights' feed stays C1/C2.
      `make_glb.py` also writes `a32_services.json` (switches + lights in page coords, switching, legs, cable schedule).
    - In the walk (x-ray): switch labels "S3 · what it switches" (constant screen size), "Edit switching": click a
      switch, then its lights; "+ Group" (double), "+ Switch" (two-way), Save -> POST `/api/switching` writes the json
      and reruns make_glb.py in `_mep_pilot\.venv` (bakepanel `switching_save`). S9 (balcony L18) was added (assumed).
    - Waste branches have a fall (`mep_model.fall`): 2 % for DN40/50, 1.5 % for DN110.
- Coordinates: model = IFC/DXF metres + `IFC_OFFSET (-32.933, -10.241, -0.18)`.
  - DXF plans (`_ref\dxf\E*.dxf`) are in mm.
  - A note's `pos` is `[u, height above Z0, v]`.
  - `Frame(W, N)`: world = (W+u, N−v, z).

### Building selector

- Page source: `flats\selector\index.html`, with `draco\` and `fonts\`.
  - three.js 0.170 from jsdelivr.
  - Every unit is an invisible volume. Hover or tap shows it as an orange X-ray, and a tap opens the card.
  - Price and status come from `/api/units`. The card matches a unit by `id` (a32, byt01...) or by `name`
    ("Ateliér 32"). Until then it shows the plan area and "podľa cenníka".
  - Which units have a walkthrough: `walks.json` next to the page (13 Oct; before, a fixed list of a32, a25, byt01 in the
    page). `r2publish.py` writes it from what is on R2 (any run; the selector goes last), `build_selector.py` from
    `flats\_export` for the Studio. A new bake shows on the website only after `python flats\r2publish.py <flat>`.
  - Common areas (15 Oct, Jano: "make the published common spaces walkable"): walks.json lists "common" too; the page
    shows "Spoločné priestory" under the logo (`../common/index.html`) and in each card "Chodba pred bytom"
    (`../common/index.html?at=<unit>`, read by walker.html).
  - Master 3D model in the selector (26 Oct, Jano: "3D selector output still doesn't show 3D master data model. why?"; "live in
    browser, but keep the same dusk / night sky and optimize assets by distance ... below 20 [MB] ideally"; the master session's
    hand-over side-session-notes\local_d3fc90b5-...\selector_master_web_set.md):
    - `flats\selector_city.py` -> `_export\selector\city\`: walks_engine `geo\geo_web_set.py if_stale=1` (the project's web copy of
      the master, made again only when the master changed; full detail within 350 m, less with distance; since 27 Oct it reaches
      past the Slovak border (Copernicus terrain, OSM buildings and land use): 326 pieces, ~17 MB; L0 tiles go to the near scene,
      which ends at 2,500 m - fine at the page's 119 m max zoom, but a test camera far out shows the sky through as an orange strip),
      web.json + web\, layers.json (the Exterior's layers "In outputs": zm = our building.glb's area cut out of the master; OXIO,
      Accord, Matadorka Living as their planned blocks from city_planned.glb), and the engine's `citytiles.js`. r2publish.py runs it
      before every selector upload.
    - The page (`loadCity()`, inside the old panorama block): `createCity(... frame 'project', layers, street: true, prep)`; prep
      adds the see-through veil (withFade) to every master material and, at night, lit windows (16 % of the facade shader's glass;
      the planned blocks' window grid likewise); the near ground takes the building's shadow.
    - Trees (27 Oct, Jano: "why do I see again those fake trees there?"; "pictures only, except closest trees within 500m radius";
      "yes, definitely lighter models"): the master's light web kit (geo_trees_web_light.py, 12 BlendKit kinds, <= 3,000 faces,
      256 px WebP, 1.9 MB) in web\treekit -> selector_city.py copies it to city\treekit\. `treeNear: 500` = 1,211 trees as models,
      the other ~12,800 as pictures. At night the pictures (unlit MeshBasic) are darkened (`IMP_NIGHT` 0.2 in prep). Without the
      kit the loader draws plain crowns. Licence: BlendKit Royalty Free models downloadable from the site - Jano's call.
      Attribution from web.json, all of it (ÚGKK, GKÚ, Copernicus, OSM: license terms), in `#attrib` bottom right: capped beside
      the compass, a faint backing, "©" kept with its name. `window.__selector.city` = the loader's handle.
    - Far panorama (27 Oct, Jano: "I see the various assets gradually loading in the distance ... Can't we just render it as a static
      panorama picture?" - "panorama fix"): past `FP_CUT` 1,500 m the city is one picture per light, `city\farpano\<day|night>.json`
      + .jpg + _mask.png (+ _m halves for phones; ~0.4 MB a light). `flats\selector_pano.mjs` renders it in headless Edge with the
      page's own `?panobake=1` (the far tiles, landmarks and far tree pictures from 60 m over the building, no haze or sky, float
      light + distance, 32 slices, resampled to 8192 px around). The page draws it as a mesh, each point at its measured distance,
      so the height and orbit keep the perspective at the seam; the live fog, sky and night tint go over it. Only the 42 pieces
      within the cut load live (8.6 MB, was 18). `FP_V` in the page = the picture's version - raise it whenever the far shading
      changes (2 = the floodlit castle, 27 Oct), then selector_city.py renders both again; a picture older than web.json's
      `web.source` or of another FP_V is not used (all tiles live, as before; also `?farpano=0`). selector_city.py re-renders the
      stale ones at each run, except while a bake runs.
    - Only the new city, by day, dusk and night (Jano, 26 Oct: "show new city model, not the old one"): the old panorama
      (`loadPanorama()`) no longer stands in when city\ is missing; it loads only with `?pano=old` (comparing). Lost with it for
      now: the floodlit castle and the aviation lights at night.
  - Bratislava panorama (16 Oct, Jano: "correct Bratislava panorama ... Castle, Malé Karpaty, Kamzík, Eurovea and other
    towers"; "start with open data"): `flats\panorama_build.py` (`python -P panorama_build.py`, ~15 s, Blender only for Draco)
    -> `_export\selector\panorama.glb` + `panorama_water.png` + `panorama.json`. One shared model for every exterior view
    (walks-studio was asked on 16 Oct to load it in exterior.html and the flats' window views).
    - Sources in `flats\_ref\panorama\`: Copernicus GLO-30 DSM tiles N48 E016/E017 (buildings removed by a 150 m opening);
      OSM buildings, chimneys and water (Overpass, multipolygons fetched by id).
    - Placement: our OSM outline (way 109456984) matched to the IFC footprint, to about 1 m. Grid +x = azimuth 28.8°, the south
      facade faces 118.8°; IFC = (u + 16.7, v + 13.5).
    - Nodes: Terrain_near / Terrain_far, Buildings_near / Buildings_far, and Buildings_low (< 24 m within 300 m; shown,
      `?pano_hide=Buildings_low` hides them).
    - Landmarks:
      - Kamzík: a square diamond spindle, as sk.wikipedia describes it.
      - The castle: the palace with four towers, floodlit at night.
      - The UFO pylon, the spires, and the 119 m Matador chimney 135 m from us.
      - Aviation lights.
    - In the selector page: the far part in its own pass (near 200 / far 26000), FogExp2, and a window shader (by day dark
      glass; at night 18 % lit, Jano: "too many ... too dense ... 10 % less"). `?pano=0` turns it off.
    - Credit line "© OpenStreetMap · © Copernicus DEM" bottom right (ODbL / Copernicus terms).
    - The cadastral industrial hall across the street stands at model y -26. extsurround's street strips (cycle path,
      sidewalk to -33.6) overlap it.
    - Castle lowered (Jano vs Google Earth: "isn't the castle too big?"): walls 20 m, hipped red roof to 29 m, towers to 36 m.
    - Castle "too wide" (Jano): OSM way 1128350263 "Bratislavský hrad" is the whole 320 x 340 m complex and had become a floodlit
      20 m wall. Now only the palace (8160490) is the castle, and outlines without a building tag are skipped.
    - Neighbours on (Jano: "turn on the neighboring buildings ... make sure they don't obstruct our camera view"): Buildings_low
      shows again. Anything in the cone from the eye to a 50 m circle round the orbit target is drawn as a screen door (one pixel in
      four), but only where it rises above the sight line to the near facade's foot. That covers buildings and trees (`withFade`).
    - Trees: only with a building within 35 m and >= 8 m tall (Jano: "only those which protrude among the buildings"); 521.
    - Checked against Jano's Google Earth view by rendering from its own camera (its URL: @lat,lon,alt a, dist d, fov y,
      heading h, tilt t). Its "35y" matches our vertical fov 28.6. Kamzík lands within ~10 px. Google only as a visual check:
      its terms don't allow taking geometry from it.
    - Building parts (`osm_parts.json`, building:part within 3.5 km): an outline that contains parts is drawn as its parts. Way
      1153991739 (Viedenská cesta, a 270 m complex tagged 85.6 m) had stood as one 85 m wall next to the castle. The castle's
      parts are white, floodlit, with red hipped roofs on the wings and pyramid caps on the towers. The rectangle is only a
      fallback.
    - Roads (Jano: "draw present roads ... Gustáva Malého, Údernícka, Pri Smaltovni and connect them to our existing roads"):
      - node Roads: OSM ways within 1 km (`osm_roads.json`) as ribbons, asphalt / light paving / red cycle paths, dashed
        centre lines on two-way streets;
      - cut inside SITE_PAVE (our site model's paving), so its own roads continue them;
      - the ground round the site is now -0.30 (its roads' level); -0.8 only under the site model;
      - page `roadMat` with polygonOffset, receives shadows.
    - Exterior notes 10, 11 and 13 (16 Oct):
      - #10 is Matadorka A, a real 29-floor / 85 m tower; its whole 3,650 m² outline had been extruded. #11 is two
        12-floor blocks (OSM survey 2023). Both are now drawn from their parts. OSM `building:colour` is used.
      - Corrections go in `OSM_FIX` = {way id: levels / height / min_height / hide} in panorama_build.py.
      - #13 (connect the roads): the streets are cut by `SiteCover`, a 0.5 m raster of the site model's own surfaces, not by
        the SITE_PAVE rectangle. The terrain apron is -0.8 only within 1.5 m of them.
      - The replies were written into the note files because the Studio was off.
      - Note 12 (walks-studio extended Pri Smaltovni's street to the Gustáva Malého crossing; surround.json "street_ext" = page x / z
        rectangle + road_y): the panorama sinks there rather than being cut, because the day selector has no surround.glb.
        Ground goes to road_y - 0.20 and roads to road_y - 0.08, ramping out over 3 / 6 m. Read on every build.
    - Planned neighbours (16 Oct, Jano: note 14 "this building needs to go - Matadorka Living"; "use this for the streets / the
      OXIO building / Accord"):
      - Sources:
        - Compass's Nová Matadorka 2020 site plan + sections (`Compass - Nova Matadorka\Spolupraca\priloha_c_1...pdf`):
          Stavba S 3 x 10 floors (35.65 m) + 2 x 8+1 (32.65 m) on the kept hall, Stavba M round tower 29 floors (90.6 m);
        - the 2025 easements plan (`OxioĦ.0_MAT_NoMa_2BSkacel_2025-05-20-Priloha_5_VecneBremena.pdf`): the streets;
        - OXIO's light study (`OxioĦ.0_MAT_DUR_03.Sektory_D-J_SVT_Posudok_okolie, preslnenie_2024-07.pdf`, p.3): sectors
          D-J, floors in black squares;
        - Accord (`AcordĦ.2_MAT_ACC_DUR_01_REV04_KOMPLET.pdf`, p.22 situácia zelene): A1-A4, floors x 3.8 + 1.5 m.
      - Plan aligner (Jano aligned all four): `flats\_export\aligner\index.html` (seltest server, 8794). It keeps
        world = Rot(rot)·(x_pt·S, −y_pt·S) + (tx, ty) in localStorage `zm.aligner.v1`. The values are copied to the scratchpad's
        nm\align.json. Note: the light study's sheet is at S 0.58 m/pt, not its labelled 1:1000.
      - Footprints: floor labels (white digits) → the smallest closed outline (2020 plan) or a flood fill to the drawn walls
        (study, Accord).
      - → `_ref\panorama\planned.json` (46 buildings, model metres) and `planned_roads.json` (the 2025 plan's coloured
        easement bands traced by colour; areas > 5,000 m² dropped as tracing errors).
      - panorama_build.py draws them as node **Planned**, removes the OSM buildings / parts under them (the old hall too), lays
        the street areas into Roads and cuts the OSM ribbons there.
      - The scripts are scratchpad-only (make_planned.py, flood_blds.py, make_vb_roads.py); planned.json is the kept result.
      - Streets (16 Oct, Jano: "draw the cycle path and all the streets according to this picture"):
        - `_ref\panorama\plan_streets.json` holds the 2025 plan's own filled shapes by colour (scratchpad make_plan_streets.py):
          0.902 road, (0.929, 0.871, 0.886) cycle path, 0.957 / 0.949 sidewalk, (0.894, 0.91, 0.886) grass. The fills are
          triangle lists.
        - Inside the plan's area these are the streets, layered in the plan's drawing order. The OSM ribbons are cut there
          (mask grown by 1 m), and the easement-band tracing (planned_roads.json) is retired.
        - Our street's section, south of the building (model y): road −17.7..−23.7, cycle path −24.7..−26.7, sidewalk
          −27.1..−29.1.
        - The selector hides surround's Street strips (default show=Lamps,Cars). walks-studio was asked to build the walk's
          street from the same file.
      - Matadorka Living (Stavba S) and Stavba M's base (Jano 16 Oct, after the visualisations): panorama_build.py
        `matadorka_living()`:
        - two vaulted brick hangars side by side (the hall split lengthwise: walls 6.5 m, rise 3.2 m, arched gables);
        - the five blocks: full floors, then two floors recessed by 1.8 / 3.6 m, green roofs;
        - the north row: 5 window columns (TEXCOORD scaled per face) and balconies on the middle 3, from floor 2;
        - M's base ("Stavba M – base" in planned.json, the 2020 plan's 1-floor hall): a sawtooth roof, 6 m teeth from 5 to 8 m.
      - Open: the study's 2-digit labels (12, 17, 21, 34, 37) are left out until Jano confirms them; the tower Ø 38 m is an
        estimate from the plan.
      - D2 (exterior note #15, 20 Oct; Jano: "this well won't be here ... what building is proposed here?"): Oxio's housing block
        straight west across the street, 15 floors, roof +48 (part +52), outline = the study's own rectangle (svt path 287045)
        through the aligner values, model x -98.7..-62.4, y -3.4..15.1. Added to planned.json by hand ("name": "D2 bývanie"); the
        low OSM building under it drops out via `replaced()`. Shows in the selector at its next R2 publish.
    - Studio notes click (Jano: "when I add a note it switches to rotation mode and stays"): selnotes.js no longer stops
      pointerup (OrbitControls never let go). It sets `e.zmNote`, and the page's card pointerup skips such events.
    - Trees (Jano: "within maybe 500 metres"): panorama.json `trees` (`make_trees`, TREE_R 550 m, none on SITE_BOX = our
      site and street). Sources: OSM single trees (only 17 here), tree rows, woods / scrub filled, and canopy where the
      Copernicus DSM stands >= 5 m over the opened terrain away from buildings. 830 trees, sparse between the blocks.
      The page draws them as three InstancedMeshes.
    - Better data for both trees and the near buildings: ÚGKK's 1 m DSM / DTM (laser scan) via geoportal.sk (to check
      before downloading). Google Earth is only a visual reference: its terms don't allow deriving models from it.
    - **Published 16 Oct** (Jano: "put today's evening and panorama work on the website as 3D selector"):
      `r2publish.py selector` uploaded panorama, planned neighbours, streets, interiors and the evening view.
      - The day view (default) has a "Večerný pohľad" button.
      - "Ukážka stavov" (the demo mix) shows only on localhost.
      - The day view also loads surround.glb (Street, Lamps, Cars; lamp lights evening only). Jano: "the 3D walk shows something else than the 3D selector" - one street model in both.
      - The Stavba S hall's footprint runs between its blocks' north and south faces, so the walk's south cycle path and
        sidewalk stay visible.
  - Drawing on demand (14 Oct, Jano: GPU stayed at 60 % after a bake with the Studio on the Bake tab): the page drew
    every frame forever and ignored the Studio's pause, so a once-opened 3D selector tab kept the GPU busy. Now it draws
    while the camera moves or the pointer / keys act (+1.5 s), and otherwise once every 2 s; `{studio: 'pause'}` stops it.
    Code that changes the scene outside those events can call `window.__selector.invalidate()`.
  - Night prototype (16 Oct, Jano: "make the 3D selector during night and light the flats inside"): `?night=1` (no
    daylight bake; night sky, moonlight, bloom). Every glass triangle goes to the nearest unit volume (< 0.9 m) and gets a
    warm emissive copy 5 cm inside: free 1.0, reserved 0.55, pre-reserved 0.24 (Jano 16 Oct), sold / unavailable dark; metals' env x0.06 at night (`GLOW`,
    `nightStatus`). `&demo=1` = a made-up status mix. Legend top left (phones: top right) with links to the day view / demo. The
    default page is unchanged. r2 (Jano: "too dark - add a moon, stronger moonlight, better starlit sky"): moonlight
    hemi 0.5 / directional 1.05; a 4096 px sky with ~9,000 stars (sizes, tints, glow on the bright ones) and a faint Milky
    Way; a moon sprite placed by the view (az -20 deg, kept inside narrow pictures, just under the top edge / low over the
    horizon); night starts with a lower camera so the sky is in the picture; GTAO off at night (it drew the sprite as a
    dark square).
  - Dusk (16 Oct r3, Jano: "lights already up, but the sky still lit from sundown; add street lights"): `?night=dusk`
    (also in the legend: Denný pohľad · Súmrak / Noc). Afterglow sky painted per pixel (orange-pink band towards u 0.5,
    violet, deep blue, first stars), violet-blue hemi + a weak warm low light, no moon. Street lamps in dusk and night:
    `selector\lamps.json` (22: the 3D walk's 4 lamps from `exterior\furn_slots.json` continued west every 11.5 m, one
    between each pair of its street trees, 5 from `_ref\site_marks.json` centre lines) - posts, a glowing lens, an
    additive warm pool on the ground; no real lights (phones). Hall B's glass (no unit near) glows cool white = the gym.
  - Evening (16 Oct r4, Jano: "western view dusk, eastern view a fixed moon with stars, blending as the user rotates; orange
    near the horizon, more violet further up"): `?night=1` (and `?night=dusk`) = one sky fixed to the compass: the
    afterglow round the October sunset (WSW, `SUNSET_AZ` 255), night + Milky Way + a fixed moon (ESE, az 105, 8 deg up) on
    the other side; dusk weight by the angle to the sunset (full < 45 deg, none > 150 deg), narrowing with height. The
    over-the-shoulder light takes the colour of the sky behind the viewer (moon blue facing the sunset, afterglow
    facing away). Building B's lights off (Jano, for now).
  - Interiors behind the lit windows (16 Oct, Jano: "real interiors, only much simpler ... stairs, mezzanines, furniture roughly
    visible"):
    - Source: walks-studio's `interiors_export.py` → `_export\selector\interiors.glb`. That's 37 flats, one node per flat
      (a01..byt03), already lit in COLOR_0. Re-run after furnish changes; it caches per flat.
    - In the evening view, every node gets a MeshBasicMaterial with vertexColors (curve pow 1.1 x 1.1), tinted
      lerp(white, warm, 0.45) x GLOW[status] x INTERIOR_K 0.95; sold = hidden. Rooms double-sided; each flat's `<flat>_back`
      box (its shell's box + 25 cm, facing in) front side only at half light, so a gap ends on a wall, not the sky.
    - The night glass is opacity 0.16 (env 0.15) once interiors load, no depth writes (two panes had shown their diagonals
      as an X). The glow panes are off in front of an interior (PANE_WITH_INTERIOR 0); hall B keeps its pane.
    - `cutBuildingInside()` (16 Oct, Jano: "this is some nonsense inside", "from this side also"): building.glb keeps the
      IFC's inner walls, floors and inner glazing, which stood in front of the rooms as moonlit navy planes. With the
      interiors on, a 25 cm 3D mask (a Data3DTexture) marks each flat: its outline from flats_geom.json shrunk 15 cm, plus
      its shell's box (interiors.glb, shrunk 15 cm) within 2 m of the outline (A32's gallery reaches IFC y 10.74 against an
      outline ending at 9.0). Every building material except frames, rails and blinds discards a fragment that is inside
      the mask or whose line of sight to the camera crosses it within 1.8 m. The facade's outer faces look away from the
      flats, so they stay. Day view unchanged. Checked 16 Oct, south and north close-ups: no navy left.
  - ONE MODEL FOR ALL VIEWS (Jano, 16 Oct): "always use same models for all views ... the same exterior as in the 3D
    exterior walk, same streetlights. Just turn off the buildings. When I add a note to move a streetlight it should move
    it everywhere." The selector's own generated street lamps were removed the same day. Asked walks-studio to export the
    walk's surroundings (extsurround / ext_layout, with swaps) once as `_export\selector\surround.glb` (groups Street,
    Neighbours, Trees_*, Lamps, Cars...), which the walk bake also uses; the selector then only switches groups per view.
    Done the same day: walks-studio's `ext_surround_export.py` writes `_export\selector\surround.glb` + `surround.json`
    (lamp lens points) from extsurround's own layout and swaps (re-exported after every exterior swap). The selector's
    evening loads it: Street, Lamps, Cars on (`?show=` to change), Neighbours / FarBlocks / trees off; each lamp is a
    PointLight (28, 18 m) + a small glow sprite. r2publish's selector folder carries it (3.9 MB, evening only).
  - Navigation is rotate and zoom only, around building A; building B is not for sale.
  - There is a rotation control bottom left. Its orange needle and "N" point to true north: the building grid's +y
    turned 61.2° towards +x (ASR north arrow "Severka 27" in E.2 Pôdorys 1.NP.dxf; the OSM outline gives 61.7°). The
    "south" facade really faces ESE (az 118°, ASR's "Pohľad juhovýchodný"). The IFC's site rotation (30°, location left
    at Archicad's default Prague) is not north.
  - 12 Oct (Jano chose option A, the live 3D page, over pre-rendered views; "the sun remains static - it always needs
    to shine on the facing side"; no trees in the selector):
    - a live sun that turns with the view (`placeSun()`, over the viewer's left shoulder, 40° up), with shadows;
    - a sky gradient, neutral tone mapping, and dark reflective glass;
    - Hall B (12 Oct, Jano: "the roof of building B is still ugly and the missing windows are like that in the IFC? small
      squares?"):
      - The IFC has no windows in hall B's long walls: 24 openings in the south wall, 10 in the north. The first fill
        (small-pane steel grids, see-through holes only) was my own guess.
      - Now `hall_b_windows()` follows the tender elevation E.15:
        - shop windows and glazed doors with pull bars at street level;
        - O14 single lights above, and O15 / O16 with a tilt sash and a glass French balcony;
        - slim champagne frames, no grid.
      - The roof is new: `hall_b_roof()` replaces the SketchUp RoofB and its caps. It is built on the IFC gables (west
        bay ridge 9.55 m, bays 9.50 m, valleys 7.10 m, ~25°). It has 0.5 m standing seams as geometry, ridge caps,
        valley and eave gutters, and openings for the IFC roof windows SO05–SO07.
      - The part names RoofB and RoofB_caps are kept for the exterior bake.
      - North wall: E.16 draws it blank, so its 10 IFC openings are bricked up in our model (Jano: "this seems to be
        correct").
      - Roof lights (12 Oct, Jano: "the roof on building B should have windows - you have some but I don't think they
        are correct"): the IFC's SO05–SO07 (4 small lights, west bay only) are left out (`shell()` keep mask). The tender
        site plan's 8 are built instead: 2 per bay on the east slope, 3.3 × 1.55 m, `HALL_B_ROOF_WIN`.
      - Sky (12 Oct, Jano: "more realistic colour and some sparse clouds"): an equirectangular sky painted in the page,
        with a deep blue zenith, a hazy horizon and sparse value-noise cumulus. The glass reflects it.
      - Hybrid B (`?hybrid=1`): the 3D selector bake as the ambient light under the live sun. It looked worse than A on
        12 Oct because that bake (11 Oct) predates the day's model changes.
      - Flat card (13 Oct, Jano: "show more information. Orientation, balcony size, show also small floorplan"):
        - new lines for layout (`rooms`), orientation (JV → juhovýchod / south-east / Südosten) and the exterior
          (type + area);
        - the small floor plan, cut from the marketing sheets by `flats\selector_plans.py` into `selector\plans\<id>.jpg`
          and `<id>_big.jpg` (opens on a click).
      - Exterior notes 6–8 (13 Oct) were done in zm_master: flat paver pads on the 24 parking spaces (`parking`, from
        `site_marks.py` `parking_pads`), roof lights with anthracite frames and dark glass (`rooflight`).
      - One Exterior bake (27 Oct, Jano: "does 3D selector need any baking at all?", then "yes" to one sunless Exterior bake for
        the Exterior, the flats' windows and the selector; no selector bake of its own):
        - `flats\selector_bake_web.py` (geo\.venv, Pillow) -> `_export\selector_bake\`: from `exterior\walk` once its exterior.json
          says `sunless` (the page adds its own sun - a sunny bake doubles it), else the old `exterior\selector`. Only the meshes with a
          "light" map + Glass (Draco copied, only renumbered); maps building 2048 / others 1024; ~3 MB instead of ~31.
        - `r2publish.py selector-bake` builds it, then uploads it as walk/selector-bake/. hooks.py `XB_SELECTOR` = walk, selector:
          their after-bake publish and the Website panel line "3D selector's light (Exterior bake)".
        - The page (Studio): baked/walk/ first, only when sunless (or `?bake=`); shows only the bake's light-mapped meshes + Glass.
        - To do after Jano's first sunless Exterior bake: tune `AMB` (set for the old even-sky bake).
      - Only version B (13 Oct, Jano: "leave only version B and remove version A. B looks slightly better when baked in
        full quality"):
        - The hybrid (bake as the sky light + live sun) is the page's default. It looks for the bake at
          `../selector-bake/` (R2, uploaded with `python flats\r2publish.py selector-bake`), then at
          `../exterior/baked/selector/` (Studio).
        - The live light alone is only the fallback (no bake, or `?hybrid=0`).
        - B draws the bake's own exterior.glb, so model changes show in B only after the next 3D selector bake.
      - Notes 5, 8, 9 (13 Oct):
        - grass in thin open gaps (`site_marks.py`, ≥3 sides within 3 m);
        - the IFC glass-wool strip M003 at the A–B junction is left out (`shell()` keep mask);
        - the parking pads sit 1.5 cm over the highest surface under them.
      - Website pushed 13 Oct (Jano chose "selector fix + all pending work"): commits 69dc4a0 + 1697cff on
        atelier-walkthrough.
        - The home button opens `https://3d.ziegermill.sk/walk/selector/index.html` (`NEXT_PUBLIC_SELECTOR_URL`
          overrides).
        - `/api/units` sends `Access-Control-Allow-Origin: *`.
        - `public/walk/selector` is removed from the repo.
        - The old local `public/walk` copies are in `git stash` ("old local public/walk copies ...").
        - For /admin online, Vercel needs `SUPABASE_SERVICE_ROLE_KEY` (Jano sets it).
      - All three points are with the architect: the missing windows in the IFC, which north openings close, and the
        missing roof. The 3D walks session adds them to the architect sheet.
    - The comparison still (Cycles) is `flats\selector_photo.py` → `_roof\selector_photo_B.png`.
    - Materials (12 Oct, Jano: "add the materials, but people, neighboring buildings no"; "the grass is artificial"):
      - textured plaster (`tex_plaster`), B's zinc roof with standing seams (`tex_zinc`) and a natural lawn (`tex_lawn`,
        SketchUp M_Grass and the ground fills);
      - the parking and road lines now follow the surface every 25 cm, and the studs are flush. They had been lifted
        to the highest surface within 0.5 m (a kerb): `site_marks.zat()`.
      - The page draws the paint with a polygon offset.
    - The Studio's baked "3D selector" view is separate (walks-studio); a baked sun can't turn with the view.
  - Until 12 Oct, the lighting was even (four equal diagonal lights + sky, no sun, no tone mapping). Shading comes from ambient
    occlusion (three.js GTAOPass): soft shade in corners, under balconies and in reveals. The flats' outlines and
    X-ray are drawn afterwards in their own `overlay` scene, so the AO doesn't see them. Fog only past 300 m.
- One source (8 Oct, Jano): `flats\zm_master.py` holds everything that makes the building look the way it does - the
  material `PALETTE` (where the selector and the walkthroughs disagreed, the walkthroughs' values won), `ifc_key()` (IFC
  style -> material, the walkthroughs' rules), `shell()` (the IFC with a palette key per triangle: old-mill brick zones,
  reveals, white slabs), `site()` (SketchUp site parts with the roof B fit, roof caps, rooftop plant). `build_selector.py`
  only chooses what the selector shows. Next: `flatifc.py` (the walkthroughs' outside context) onto it - that changes
  Jano's next bake, so it waits for his OK.
- Rooftop plant (`rooftop_plant()`): a PROPOSAL, no HVAC project yet. On the main roof in the strip behind (north of)
  the roof-access pavilion (IFC x 11.5-20.2, y 14.3-16.8), closed by a 2.16 m acoustic louvre screen of the pavilion's
  height and colour, so it reads as part of the pavilion (Jano: on top of the pavilion was ugly). Below the strip are the
  lift, its lobby and the stairs; only its west end (x < 13.9) is over Byt 03, and that is kept as service space by the
  door. Inside: 4 VRF outdoor modules over the core (8 HP; sized by cooling, ~85-90 kW - base heating is underfloor from an
  air-water heat pump on 1NP), with discharge cowls past the screen top; 4 exhaust fans over the stairs (2 kitchen
  ~5,000 m3/h, 2 bathroom ~3,000 m3/h) with slim stacks 0.84 m above the screen. Rubber-mounted frames on concrete
  plinths. Six 6NP flats: one compact heat-recovery unit inside each flat; on the roof only an intake + an exhaust
  cowl above each (12 cowls along the bench line and the north parapet, intakes >= 7 m from the kitchen stacks).
  Collector ducts from the 5 shafts away from the core (x 4-7 and 23-25.5): one insulated casing ~0.9 m wide, ~0.45 m
  over the paving with a wooden top - modelled as L-shaped benches west and east of the pavilion (along the corridor line
  IFC y ~9, then along the pavilion's side walls into the enclosure); the 4 core shafts rise inside via the 6NP lift
  lobby. The terrace design should keep them as benches / planter edges. VRF pipe runs
  (~60-80 m to the farthest indoor unit) are within usual limits; R32 will need leak detection in the smallest rooms.
- Model: `build_selector.py`, run with headless Blender. In the cloud it also runs with `pip install bpy==5.0.1`, with
  `ZM_FLATS` pointing at a copy of the inputs. It writes `flats\_export\selector\` (building.glb with Draco,
  flats_geom.json, plus the page).
- Inputs:
  - `_ref\ifc_260529.npz`: triangles of the ASR IFC `260529_model.ifc`.
  - `_ref\units_dxf.json`: 37 unit outlines from the DXF room zones, made by `_stage28\dxf_flats.py` (ezdxf + shapely).
    Rooms are grouped across walls < 0.22 m. The units are 2NP A01–05, 3NP A06–13, 4NP A14–22, 5NP A23–31, and 6NP
    Byt 01–03 + A32–34. Floors 4–6 have galleries.
  - `_ref\site_skp.npz`: from the older SketchUp model (`scene_v1_before_blendkit.blend`, read only). It holds building B's roof
    (`Konstrukcie_Krytina`, which the IFC lacks), the paving with the garage ramp, the terrain, and building B's east end
    wall.
- Rules baked in:
  - What you can see from outside is kept; all walls, slabs and stairs are kept so windows don't look hollow.
  - Underground only where open to the sky (the ramp); the garage gate is closed.
  - Blinds rolled up; no stairs on 6NP.
  - Old mill = brick texture (`tex_brick`: the old Austrian format 290×140×65 mm in 10 mm joints, a 2.4×2.4 m patch
    where every brick differs - mostly buff, some cream, a few ochre / darker, the odd grey; mottled, worn edges, uneven
    joints; average sRGB ~`#DBCDAB`, as the ASR visualisations; textures exported as JPEG): building B (from the A–B link wall at IFC
    x 29.66), and in building A the old mill box (IFC x 0–30.2, y 0–11) up to the top of 3NP on every outer side that
    shows (south facade, west wall's south part, east wall above B's roof, east end of the north wall), plus the 4NP
    arch gable. Window reveals, sills and heads in those walls are brick too. Everything else of building A is white,
    slabs and balconies included, their tops too.
  - Frames, railings and copings (`Barva 09`): champagne, sRGB `#B0A48C`.
  - Building B's roof (SketchUp, an older design) is moved +0.62 m in x (`ROOF_DX`) to sit on the IFC gables and
    stretched in y onto the long walls' outer faces (`roof_y`), light zinc grey; its six roof-light openings in the valleys are capped (`ROOF_HOLES`, caps follow the valley).
  - Paving: the pavements have light-grey slabs in running bond; small generated textures, UV in metres (`TEX`,
    `tex_uv`).
  - Exterior notes 1–5 (10 Oct 2026, done in `zm_master.py`; they show after a selector rebuild + exterior bake):
    - Streets and parking aisles are asphalt (`asphalt`, was herringbone). Dashed centre lines on the north street, the
      west road and the curve into Pri Smaltovni.
    - Hall B's roof is anthracite (`roof_zinc`).
    - Lines and solar road studs on the 24 outdoor spaces E01–E24.
    - Grass fills the ~26 m² of holes in the ground.
    - The lines, studs and fills come from `flats\site_marks.py` → `_ref\site_marks.json` (a 0.25 m raster of the
      model's own surfaces; the parking from `C:\ZM-WEB\supabase\seed\parking.sql`, the site plan placed on the IFC
      parking strips). `site()` adds them as `SiteMarks` and `GroundFill`. Rerun `site_marks.py` when the site changes.
    - Replies posted with the Studio notes API (scratchpad script).
- IFC levels (IFC z, floor → underside of the slab above): 2NP 3.23–5.83, 3NP 6.16–8.76, 4NP 9.09–14.24,
  5NP 14.57–19.72, 6NP 20.05–25.55.

## Open items

- Bake queue window: built 9 Oct, see the Studio section. It needs one Studio restart to take over. Then Jano signs
  in to GitHub once (`git credential-manager github login`) and presses "Retry all" on the night's three bakes.

- BYT 01 #13 done 15 Oct (Jano: "keep but hide it behind drywall"): params `BAND_BOX = True` makes `build_ifc_flat.py` box
  the IFC's steel window transoms (Obj0003) in 12.5 mm white board inside the reveals (`<PX>_BandBoxes`, shell group).
  On (Jano 15 Oct: "yes box them") in BYT 01-03, A34, A14-A22 and A28-A31.
  BYT 01 notes #24 (dark 6.04 lighting), #37 (double corner) and #39 (WC + shower in 6.09) were waiting for Jano's answers.
- BYT 01 15 Oct notes 96-106 (byt01_params.py block): `STEEL_PAINT` (black steel as non-metal charcoal paint - gloss_flat.py's
  "metal" class mirrored the room and read grey; build_ifc_flat.py swaps it when set), `WC607_V` / `IFC_MOVE` (WC basin and
  mirror off the door's swing), `TILE_PATCHES`, `SHOE_BENCH_V`, `WASHER_AT` (a dryer stacked on the washer; the washer
  model choice is open, note 101), `mirror_under()` in furnish_byt01.py (LED under the mirrors). gloss_flat.py: names with
  "matte" / "paint" / "brushed" are satin before any material word ("steel" alone is still metal).
- A34 note 53: `FF.Piece.build(recalc=False)` keeps hand-turned faces (the A34 stair's loose faces flipped under
  recalc_face_normals - black treads, not walkable).
- A11 notes 1-7 (15 Oct): `furnish_a11.py` is now its own script (furnish_ifc_min.py's code + the notes, as A34's), data in
  `a11_params.py`'s 15 Oct block (`DOORS`, `WARD_HALL` / `WARD_ROOM`, `BED`, `KITCHEN`, `DEVICES`). No shared code changed.
- A32 note 132 (stair/cabinet "seamless slope"): reading (a) flush oak front or (b) closed risers? Waiting for Jano.
- DB-driven price/area chip inside the walkthroughs: planned, "not now".
- The building's exterior will get nicer once the architect delivers exterior objects.
- `/cennik` could use the 3D selector instead of `selector.png`.
- Supabase (9 Oct 2026): DONE through `supabase-zieger` - the public can only read units (`is_public`) and site_settings and
  submit leads; admin tables, change history and the admin functions are server-only; 37 units from the price list are
  live (placeholders hidden, not deleted). Open: Jano changes the admin password (its hash was public); switch
  `/api/units`, `/cennik` and the selector card to the new fields and read `site_settings` (`show_prices` is not used
  by the site yet); destructive cleanup in `20261009090000_cleanup_open_policies.sql` (the connector cannot confirm
  destructive statements from the desktop app); pin the functions' search_path; later move /admin to Supabase Auth.
- Price list areas (9 Oct 2026): lofts on 4NP-5NP need both the official area (kataster: interior + exterior) and the
  additional floor space (RC slab over bathroom + entrance, RC slab over the common corridor, wooden mezzanine) shown
  apart. Draft for Jano to check: `_cennik\Zieger cennik 082026 - plochy (navrh).xlsx` (local, not in git). Slabs from the
  tender DXF layer "medzipodlažie" (E6, E8); corridor slab: 5NP belongs to A23/A24/A27 (one piece with their slab), 4NP
  is split by the south-row partition walls (E.6) among A14-A18; wooden mezzanine = the list's "výmera s pódiom" -
  interior - slabs. 6NP galleries are official. After his OK: DB columns + import script + website.
  The draft changes none of the price list's numbers (all 37 totals and prices match); it only splits "výmera s pódiom".
  Jano wants to judge the wooden mezzanine sizes visually once 3D walks of A16, A24 and A26 exist (not built yet;
  today only A32, A25, BYT 01).
- CRM (9 Oct 2026). Built, not yet tested end-to-end: local `.env.local` has no service-role key, and nothing is
  committed yet.
  - Contracts: the lawyer's RZ / ZBKZ redlines of 18 Sep are in `_Predaj a prenajom\Legal`. No KZ draft for the flats
    was found.
  - There is no Ziegermill Standard yet:
    - `_Predaj a prenajom\Standard` holds competitors' standards (Lofty Kominárska, Matadorka Living ...);
    - the tender's `ASR\PDF\TS.pdf` (technical report) is the basis for writing one.
  - Email from the agent's own address (e.g. `@nidal.sk`; its mail is at Pixel Corporation, SPF `-all`). Either:
    - Nidal's DNS admin adds the mail service's SPF/DKIM records for nidal.sk; or
    - send from a ziegermill.sk address (Jano's domain, mail at exohosting) with Reply-To + CC to the agent.
  - Co-ownership shares in the contracts are not needed for the first drafts; later they come from the areas or from
    the lawyer/geodesist.
- Community roof (10 Oct 2026, in progress). `zm_master.roof_terrace(variant)`, chosen with env `ZM_ROOF`:
  `common_natural` | `common_industrial` | `mixed`; default none, so the public selector shows no unchosen design.
  - Roof facts (tender): ST01 walkable roof, tiles on pedestals at +26.18, 439 m². The parapet is only ~0.5 m and
    the IFC has no roof railing. The lift ends at 6.NP. Three 6.NP skylights (OS 01) stand on the roof.
  - Jano's brief: inexpensive only (lounge sofas, loungers, electric grill without a sink, small kids' corner,
    raised beds); both looks for the common roof. Instead of all-private, only "D - mixed": Byt 01/02/03 get private
    terraces, each with its own spiral stair and an insulated opaque hatch (deck on the lid) where its skylight was;
    the rest stays common. A private terrace reached via the common stair "isn't worth it" (pajamas test).
  - Jano, 10 Oct: industrial is out (`common_industrial` stays in the code only for reference).
  - D: Byt 02 also gets the NE corner over A34 (Jano: "give it all to Byt 02"), so the common part is one
    piece in front of the stair door, bounded east by the duct casing - no step-over any more.
  - D areas (11 Oct, measured on `zm_master`'s rectangles to the inside of the railing; free floor = without the
    planter band, duct benches and screens; scratchpad `roof_areas.py`): Byt 01 101 m² (80 free), Byt 02 139 m²
    (96 SE + 43 NE; 106 free), Byt 03 60 m² (47 free), common 108 m² (100 + 9 m² maintenance path; 93 free). Total
    409 m², plus the pavilion 34 m² and the plant enclosure 21 m². Earlier "~120 m²" for Byt 02 was too low.
  - D private terraces (11 Oct, Jano: "electric grill place with some roof and some umbrellas and jacuzzi", privacy;
    "don't check neighboring buildings" - the surrounding model is placeholders): each has an electric grill counter +
    dining table under a louvred aluminium pergola (champagne) by its hatch, a hard-shell hot tub in the corner of two
    outer walls over its own double-height living room (not over bedrooms or A34; ~5 kN/m² filled, statics to confirm),
    2.0 m double-row slat screens on the tub's outer sides, a tilting cantilever parasol over the tub and a centre-pole
    parasol over the lounge. All boundary screens are now 2.0 m with two offset slat rows (closed to the eye, open to
    wind). Renders `_roof\renders\roof_mixed_{bird,bird_n,byt01,byt02,byt03}.png`.
  - Skylights OS 01 removed in every variant (Jano, 10 Oct), subject to the daylight check: the question is with the
    architect (sheet). Rough costs given to Jano: A/B ~€60-95k, D adds ~€15-35k per private flat for stair + hatch;
    an extra lift stop to the roof ~€30-60k (not wanted).
  - The 12 ventilation cowls moved into the parapet planter band (`COWLS`).
  - Waste-stack vents (15 Oct, from walks-studio; architect point 28): every waste stack must vent above the roof (open,
    ~2 m over the walkable deck, away from hatches) unless the HVAC engineer uses air admittance valves with one main
    vent. A32's two stacks are drawn in its services model.
    - In the master model since 16 Oct (Jano: "can you draw them also in exterior models on the roof?"): `WASTE_STACKS`
      (the 20 stacks of E.9, IFC metres) -> 13 terminals in `rooftop_plant()` (part RooftopPlant, so the exterior bakes
      take them): stacks < 0.5 m apart share one; PP pipe + cap 2.0 m over the deck, 0.5 m over the pavilion roof for
      the two under it. Provisional (sheet points 28/29). They show in the selector / 3D walk after the next bakes.
  - Plans and sketches: `_roof\Strecha_A_*.png` (local, excluded from git). Renders: `flats\roof_preview.py` (Eevee,
    not a bake, ~45 s a view; run only when no bake is running): `-- variants=... views=bird,table,west,corner`.
- Community terrace on the roof of A: to be designed. Then tidy up the rooftop plant with it (Jano: "too many exhausts,
  this would spoil the whole roof") - the 12 per-flat ventilation cowls, the duct benches and the exhaust stacks are a
  first placement only (`rooftop_plant()` in `zm_master.py`).
- Move to Cloudflare (12 Oct 2026, Jano: "let's go", Vercel stays as the fallback). Reason: Vercel free deployment
  storage at 75 % of 10 GB, because every Studio push stores the whole site (~228 MB, mostly `public/walk`).
  - Plan:
    - DNS, website (Workers via OpenNext) and 3D files (R2 bucket `ziegermill-3d`, `3d.ziegermill.sk`) on Cloudflare;
    - email via Cloudflare Email Routing (forward `michal.tichy@ziegermill.sk` → `michal.tichy@nidal.sk`,
      `jan@ziegermill.sk` → Gmail) plus Resend for sending as ziegermill.sk.
  - Done: DNSSEC off at exohosting; nameservers changed to `cecelia` / `gabriel.ns.cloudflare.com` (registry updated
    12 Oct). The .sk registration stays at exohosting (Cloudflare can't register .sk).
  - Test build (scratchpad copy): OpenNext 1.20 + wrangler 4.149. The server code is 1.7 MB gzip, under the free 3 MB.
    - On Windows, pnpm needs `node-linker=hoisted`: the adapter's symlinks fail with EPERM without Developer Mode.
  - 29 Oct: the Workers setup is on branch `claude/ecstatic-pasteur-4z2dza` (off `atelier-walkthrough`, to merge into it;
    Vercel keeps building it as before).
    - Next 16.1.6 → 16.4.3 (OpenNext 1.20 needs ≥ 16.4.1), `@opennextjs/cloudflare` + `wrangler` dev deps,
      `wrangler.jsonc` (Worker `ziegermill-sales`, `nodejs_compat`), `open-next.config.ts`, `public/_headers`
      (immutable `/_next/static`), `nodeLinker: hoisted` in `pnpm-workspace.yaml`, `.dev.vars.example`.
    - `pnpm preview` = build + run the Worker locally (needs `.dev.vars`); `pnpm deploy` = build + deploy.
    - Checked in workerd locally: pages, `/api/*`, `public/walk` (`exterior.glb` is 24.0 MiB, under the 25 MiB
      per-file limit). `/walk/x/index.html` redirects 307 to `/walk/x/`, query kept.
    - Mail on Workers: use `RESEND_API_KEY` (fetch). Don't set `SMTP_HOST` there (nodemailer needs raw TCP).
    - Next: Cloudflare Workers Builds connected to the repo, branch `atelier-walkthrough`, build
      `pnpm exec opennextjs-cloudflare build`, deploy `pnpm exec opennextjs-cloudflare deploy`; the
      `NEXT_PUBLIC_*` vars in the build settings (inlined at build), the rest as Worker secrets
      (`SUPABASE_SERVICE_ROLE_KEY`, `REVIEW_SYNC_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL`); custom domain
      on the Worker; then test /admin, /review sync and uploads before switching over.
- Building services pilot (11 Oct 2026, Jano: plan pipes and cables from the model, x-ray through walls, "something like
  BIM"): `flats\_mep_pilot\` (README.md there).
  - A32 only: services IFC, quantities and costs (€27k / €43k / €69k excl. VAT, i.e. 412 / 654 / 1,056 €/m²; prices
    mostly assumptions), plans, `xray.html`.
  - `clash_check.py`: no pipe runs inside structural concrete; it lists the core drills / sleeves and ~10 m of cable in
    RC walls.
  - Bonsai is installed isolated in `_mep_pilot\blender_cfg` (Jano's OK; his Blender profile untouched).
    `Open in Bonsai.cmd` opens the services model linked to the architect's IFC.
  - Not in the tender: the flats' plumbing / heating / electrical / ventilation design and their bill of quantities.
  - The x-ray toggle in the Studio's 3D walk was passed to the walks-studio session (it owns walker.html / bakepanel.py).
- 6NP heat recovery: only A32 and A33 need it (10 Oct, checked in the IFC; Jano asked whether all top flats need air
  exchange).
  - BYT 01–03 and A34: every habitable room, gallery bedrooms included, has an openable window. The 5 m windows open on
    both levels; the IFC has a lever handle ~1.1 m above the gallery floor on the upper sash, only where a gallery room
    is behind it.
  - A32 and A33: the only 2 windows are in the double-height space. Each 28 m² gallery runs 3.3–10.5 m behind the
    facade with no window of its own, so it needs supply and extract.
  - Bathrooms and WCs: the central shaft extract in every flat. The four exhaust-only flats need fresh-air inlets
    (trickle vents). The energy assessor must confirm A0 without heat recovery in those four.
  - So the roof needs 4 cowls instead of 12. Skylights: the 1.2 m holes over BYT 01, 02 and 03's gallery corridors
    (no glazing in the IFC) can go; the two SO07 smoke vents over the stairwell stay (fire design).
