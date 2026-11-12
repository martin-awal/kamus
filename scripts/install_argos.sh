#!/bin/bash
# Optional offline translation engine: Argos Translate (MIT) with the id<->en models (CPU only), in its OWN environment
# (.argos-env) so it cannot disturb the speech environment (.tts-env pins numpy and torch versions).
set -e
cd "$(dirname "$0")/.."
CONDA="${CONDA:-$(command -v conda || echo "$HOME/miniforge3/bin/conda")}"
export TMPDIR="${TMPDIR_FOR_PIP:-$HOME/.cache/kamus-pip-tmp}"; mkdir -p "$TMPDIR"
[ -x .argos-env/bin/python ] || "$CONDA" create -y -p .argos-env python=3.11 pip
P=.argos-env/bin/pip
$P install torch --index-url https://download.pytorch.org/whl/cpu     # argostranslate -> stanza needs torch; avoid the huge CUDA build
$P install argostranslate
.argos-env/bin/python - <<'PY'
import argostranslate.package as pkg
pkg.update_package_index()
for a, b in (("id", "en"), ("en", "id")):
    p = next(p for p in pkg.get_available_packages() if p.from_code == a and p.to_code == b)
    pkg.install_from_path(p.download())
    print("installed", a, "->", b)
PY
echo "Done. Restart the server and pick Argos in Settings -> Translation."
