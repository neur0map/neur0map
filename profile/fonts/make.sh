#!/usr/bin/env bash
# Rebuilds the font subsets and metrics.json from a ryoku-site checkout that
# has node_modules installed. Needs fontTools. Arrows and the star are drawn
# in build.mjs, so they aren't in the subsets.
#   profile/fonts/make.sh /path/to/ryoku-site
set -euo pipefail
site=${1:?usage: make.sh /path/to/ryoku-site}
here=$(cd "$(dirname "$0")" && pwd)
nm=$site/node_modules
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
uni="U+0020-007E,U+00A0,U+00B7,U+00D7,U+00E9,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2122"

python3 - "$nm" "$tmp" <<'PY'
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
nm, tmp = sys.argv[1], sys.argv[2]
fr = f"{nm}/@fontsource-variable/fraunces/files/fraunces-latin-wght-"
sg = f"{nm}/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2"
for src, dst, wght in [(fr + "normal.woff2", "fr-400", 400), (fr + "italic.woff2", "fr-italic-400", 400),
                       (sg, "sg-400", 400), (sg, "sg-300", 300)]:
    f = TTFont(src)
    instancer.instantiateVariableFont(f, {"wght": wght}, inplace=True)
    f.flavor = None
    f.save(f"{tmp}/{dst}.ttf")
PY
for p in fr-400 fr-italic-400 sg-400 sg-300; do
  pyftsubset "$tmp/$p.ttf" --unicodes="$uni" --layout-features='kern,liga' --flavor=woff2 --output-file="$here/$p.woff2"
done
pyftsubset "$nm/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2" --unicodes="$uni" \
  --layout-features='kern' --flavor=woff2 --output-file="$here/sm-400.woff2"
pyftsubset "$site/app/assets/fonts/ryoku-jp-700.woff2" --text="力美とのためにさ感謝道剣守" \
  --flavor=woff2 --output-file="$here/jp-700.woff2"

python3 - "$here" <<'PY'
import json, sys
from fontTools.ttLib import TTFont
here = sys.argv[1]
out = {}
for name in ["fr-400", "fr-italic-400", "sg-400", "sg-300", "sm-400", "jp-700"]:
    f = TTFont(f"{here}/{name}.woff2")
    upm, hmtx = f["head"].unitsPerEm, f["hmtx"]
    out[name] = {"advance": {chr(c): round(hmtx[g][0] / upm, 4) for c, g in f.getBestCmap().items()}}
json.dump(out, open(f"{here}/metrics.json", "w"), ensure_ascii=False, separators=(",", ":"))
PY
echo "fonts and metrics.json rebuilt in $here"
