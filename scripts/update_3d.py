"""Copy the 3D parts made by the Blender pipeline into the website.

    python scripts/update_3d.py                 # every walkthrough + the building selector
    python scripts/update_3d.py a32 byt01       # only these (use "selector" for the selector)
    python scripts/update_3d.py --src D:\\other\\_export
    python scripts/update_3d.py --patch-only    # only bring the back buttons in public/walk up to date

Source: the pipeline's export folder (default C:\\Users\\PC1\\Documents\\SKP_cleanup\\blender_scene\\flats\\_export,
or the ZM_EXPORT environment variable, or --src). Made there by export_web.py (one folder per flat) and
build_selector.py (selector\\).

Target: public/walk/<flat>/ and public/walk/selector/ - mirrored (files that no longer exist in the source are removed).
Each page gets a back button (the exports are standalone and do not have one): the walkthroughs "Späť na výber
priestorov" to the building selector, the selector "Späť na web" to the home page. The selector links the
walkthroughs as ../<flat>/index.html, so it has to sit next to them in public/walk/.
Replaces scripts/update-walks.sh (bash + rsync, Optiplex) - this one runs on Windows too.
"""
import os, re, sys, json, shutil, filecmp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = r"C:\Users\PC1\Documents\SKP_cleanup\blender_scene\flats\_export"
DEST = os.path.join(ROOT, "public", "walk")

BACK_SVG = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>')
def button(href, labels):
    """The back button. It keeps the page's ?lang= (the website passes the visitor's language down: home page ->
    selector -> walkthrough, Jano 10 Oct 2026) and shows its label in that language (sk default, en, de)."""
    pick = ("<script>(function(){var t=" + json.dumps({k: v for k, v in labels.items() if k != "sk"}, ensure_ascii=False)
            + "[(new URLSearchParams(location.search).get('lang')||'').toLowerCase()];"
            "if(t)document.getElementById('backLabel').textContent=t;})()</script>")
    return (f'<button id="back" class="chip" type="button" onclick="location.href=\'{href}\'+location.search">' + BACK_SVG
            + f'<span id="backLabel">{labels["sk"]}</span></button>' + pick + '\n')


# Walkthroughs go back to the building selector ("Ponuka priestorov", Jano 9 Oct 2026); the selector to the website.
BUTTON_WALK = button('/walk/selector/index.html', {"sk": "Späť na výber priestorov", "en": "Back to all units", "de": "Zurück zur Auswahl"})
BUTTON_SELECTOR = button('/', {"sk": "Späť na web", "en": "Back to website", "de": "Zurück zur Website"})
OLD_BUTTON = re.compile(r'<button id="back"[^>]*>.*?</button>(<script>\(function\(\)\{var t=[^<]*</script>)?', re.S)


def update_button(path, s, btn):
    """An already patched page: bring its back button up to date."""
    new = OLD_BUTTON.sub(lambda m: btn.rstrip("\n"), s, count=1)
    if new != s: open(path, "w", encoding="utf-8", newline="\n").write(new)


def patch_walk(path):
    """Walkthrough page: back button top left, the flat's name chip moves down below it."""
    s = open(path, encoding="utf-8").read()
    if 'id="back"' in s: return update_button(path, s, BUTTON_WALK)
    css = '#brand { position: fixed; left: 16px; top: calc(16px + env(safe-area-inset-top, 0px));'
    html = '<div id="brand" class="chip">'
    if s.count(css) != 1 or s.count(html) != 1:
        sys.exit(f"{path}: the walkthrough layout changed - update patch_walk() in scripts/update_3d.py")
    s = s.replace(css, '/* Back to the website (a <button> because the page cancels touches on anything else) */\n'
                  '#back { position: fixed; left: 16px; top: calc(16px + env(safe-area-inset-top, 0px)); z-index: 6; display: flex; '
                  'align-items: center; gap: 6px; padding: 9px 14px 9px 10px; font: 500 13px/1 var(--ui); color: var(--ink); cursor: pointer; }\n'
                  '#back:hover, #back:focus-visible { background: var(--glass-strong); outline: none; }\n'
                  '#brand { position: fixed; left: 16px; top: calc(68px + env(safe-area-inset-top, 0px));')
    s = s.replace(html, BUTTON_WALK + html)
    open(path, "w", encoding="utf-8", newline="\n").write(s)


def patch_selector(path):
    """Selector page: back button top right (the logo has the top left)."""
    s = open(path, encoding="utf-8").read()
    if 'id="back"' in s: return update_button(path, s, BUTTON_SELECTOR)
    if s.count("</style>") < 1 or s.count('<div id="view"></div>') != 1:
        sys.exit(f"{path}: the selector layout changed - update patch_selector() in scripts/update_3d.py")
    s = s.replace("</style>", '#back { position: fixed; right: 16px; top: calc(16px + env(safe-area-inset-top, 0px)); z-index: 3; display: flex; '
                  'align-items: center; gap: 6px; padding: 9px 14px 9px 10px; font: 500 13px/1 var(--ui); color: var(--ink); '
                  'background: var(--paper); cursor: pointer; }\n#back:hover, #back:focus-visible { background: var(--paper-strong); outline: none; }\n</style>', 1)
    s = s.replace('<div id="view"></div>', '<div id="view"></div>\n' + BUTTON_SELECTOR.rstrip("\n"), 1)
    open(path, "w", encoding="utf-8", newline="\n").write(s)


def mirror(src, dst):
    """Copy src over dst; drop files and folders dst has that src no longer has. Returns (copied, removed)."""
    copied = removed = 0
    os.makedirs(dst, exist_ok=True)
    for base, dirs, files in os.walk(src):
        rel = os.path.relpath(base, src); tb = os.path.join(dst, rel) if rel != "." else dst
        os.makedirs(tb, exist_ok=True)
        for f in files:
            a, b = os.path.join(base, f), os.path.join(tb, f)
            if f == "index.html" or not os.path.exists(b) or not filecmp.cmp(a, b, shallow=False):
                shutil.copy2(a, b); copied += 1
    for base, dirs, files in os.walk(dst, topdown=False):
        rel = os.path.relpath(base, dst); sb = os.path.join(src, rel) if rel != "." else src
        for f in files:
            if not os.path.exists(os.path.join(sb, f)):
                try: os.remove(os.path.join(base, f)); removed += 1
                except OSError as e: print("  could not remove", os.path.join(base, f), "-", e)
        if not os.path.exists(sb):
            try: os.rmdir(base)
            except OSError: pass
    return copied, removed


def main():
    args = sys.argv[1:]
    if "--patch-only" in args:               # re-patch what is already in public/walk, copy nothing
        args.remove("--patch-only")
        for n in args or sorted(d for d in os.listdir(DEST) if os.path.isfile(os.path.join(DEST, d, "index.html"))):
            (patch_selector if n == "selector" else patch_walk)(os.path.join(DEST, n, "index.html"))
            print(f"public/walk/{n}: back button up to date")
        return
    src = os.environ.get("ZM_EXPORT", DEFAULT_SRC)
    if "--src" in args:
        i = args.index("--src"); src = args[i + 1]; del args[i:i + 2]
    if not os.path.isdir(src): sys.exit(f"export folder not found: {src}")
    names = args or sorted(d for d in os.listdir(src) if os.path.isfile(os.path.join(src, d, "index.html")))
    for n in names:
        s = os.path.join(src, n)
        if not os.path.isfile(os.path.join(s, "index.html")): sys.exit(f"{s} has no index.html")
        d = os.path.join(DEST, n)
        c, r = mirror(s, d)
        (patch_selector if n == "selector" else patch_walk)(os.path.join(d, "index.html"))
        print(f"public/walk/{n}: {c} files copied, {r} removed")


if __name__ == "__main__":
    main()
