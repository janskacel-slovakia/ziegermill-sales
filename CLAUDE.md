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
- Before claiming something doesn't exist, research it, and say what was searched.
- Branding: the Ziegermill visual identity (`LOGO\ZIEGERMILL_IDENTITA_V3.pdf`).
  - Name: "Ziegermill".
  - Colours: Orange `#ffa62b`, Dark `#544740`, Neutral `#d6d9c7`, Blue `#3091b2`, Accent Blue `#04318c`.
  - Fonts: PP Frama (paid) or Google Sans (regular/medium/bold, files in `LOGO\Google_Sans`).
- Public pages are in Slovak.
- Commit or push only when Jano asks. Work on branch `atelier-walkthrough`; `main` is production.

## Website

- Next.js 16.1.6 (App Router), React 19, Tailwind 4, framer-motion, mapbox-gl.
- Supabase holds the flats (`units` table). Keys are in `.env.local`, never print them; see `.env.local.example`.
- Git remote: `janskacel-slovakia/ziegermill-sales`. Vercel project `ziegermill-sales`.
- Pages:
  - `/` is the teaser. Its hero button "Ponuka priestorov" links the 3D selector `/walk/selector/index.html`.
  - `/cennik` is the price list. It still uses `public/selector.png` as the building picture.
  - `/mapper`.
  - `/admin`, which the agent uses to change prices and status (`/api/admin/*`, login).
- `/api/units` is the public JSON of the units: `id, name, unit_type, floor_number, rooms, interior_area, exterior_area,
  exterior_type, orientation, price, price_per_m2, status (available|reserved|sold)`. The DB still holds placeholder
  units (6A, 6B, 5A...).
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

The script mirrors `flats\_export\<name>\` into `public\walk\<name>\` and adds a "Späť na web" button: top left on the
walkthroughs, top right on the selector. Then commit and deploy. Size is about 14 MB per walkthrough and 1 MB for the
selector.

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
- Studio: `Studio.cmd` starts `bakepanel.py` on http://127.0.0.1:8790, local only. It has three tabs:
  - Walk & notes: the latest bake, with review notes in `flats\<flat>\notes\`, API `/api/notes?flat=X`.
  - Bake.
  - Flats.
  - Replies to notes are posted with a small script like `_stage28\r19r_reply.py` (PATCH reply + round, status done).
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
  - There is a rotation control bottom left.
  - Lighting is even (no shadows, no tone mapping).
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
  - Old mill = brick `#C4A57E`: building B, plus building A's south facade up to the top of 3NP and the 4NP arch gable.
    Everything else of building A is white.
- IFC levels (IFC z, floor → underside of the slab above): 2NP 3.23–5.83, 3NP 6.16–8.76, 4NP 9.09–14.24,
  5NP 14.57–19.72, 6NP 20.05–25.55.

## Open items

- BYT 01 notes #13 (window steel profiles: ask the architect), #24 (dark 6.04 lighting), #37 (double corner) and #39
  (WC + shower in 6.09) are waiting for Jano's answers.
- A32 note 132 (stair/cabinet "seamless slope"): reading (a) flush oak front or (b) closed risers? Waiting for Jano.
- DB-driven price/area chip inside the walkthroughs: planned, "not now".
- The building's exterior will get nicer once the architect delivers exterior objects.
- `/cennik` could use the 3D selector instead of `selector.png`.
