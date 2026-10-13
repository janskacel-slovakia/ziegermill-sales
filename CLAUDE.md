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
  (mobile controls: left thumb walks, right half looks; A32 ⇄ A25 switch).
- Previews (no bake): `preview_flat.py -- flat=X quality=quick views=<json> pv=<dir>`.
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
  - A model car: decimated to 60k faces, its glass becomes the walk's car glass, and a length outside 2.4–7.5 m is
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
  - The WALK map in the page lists which units have a walkthrough.
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

- BYT 01 notes #13 (window steel profiles: ask the architect), #24 (dark 6.04 lighting), #37 (double corner) and #39
  (WC + shower in 6.09) are waiting for Jano's answers.
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
