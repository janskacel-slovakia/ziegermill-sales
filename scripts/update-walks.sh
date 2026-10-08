#!/usr/bin/env bash
# Copy the 3D walkthroughs from _export/ into public/walk/ and add the
# "Späť na web" button (the exporter doesn't include it).
# Usage: scripts/update-walks.sh            (all folders in _export/)
#        scripts/update-walks.sh a32 a25    (only these)
set -euo pipefail
cd "$(dirname "$0")/.."
flats=("$@")
[ ${#flats[@]} -eq 0 ] && for d in _export/*/; do flats+=("$(basename "$d")"); done
for f in "${flats[@]}"; do
  rsync -a --delete "_export/$f/" "public/walk/$f/"
  python3 - "public/walk/$f/index.html" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
if 'id="back"' in s: sys.exit()
css = '#brand { position: fixed; left: 16px; top: calc(16px + env(safe-area-inset-top, 0px));'
html = '<div id="brand" class="chip">'
assert s.count(css) == 1 and s.count(html) == 1, f'{p}: exporter layout changed, update scripts/update-walks.sh'
s = s.replace(css, '''/* Back to the website (a <button> because the page cancels touches on anything else) */
#back { position: fixed; left: 16px; top: calc(16px + env(safe-area-inset-top, 0px)); z-index: 6; display: flex; align-items: center; gap: 6px; padding: 9px 14px 9px 10px; font: 500 13px/1 var(--ui); color: var(--ink); cursor: pointer; }
#back:hover, #back:focus-visible { background: var(--glass-strong); outline: none; }
#brand { position: fixed; left: 16px; top: calc(68px + env(safe-area-inset-top, 0px));''')
s = s.replace(html, '''<button id="back" class="chip" type="button" onclick="location.href='/'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>Späť na web</button>
''' + html)
open(p, 'w', encoding='utf-8').write(s)
PY
  echo "updated public/walk/$f"
done
