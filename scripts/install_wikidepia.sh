#!/bin/bash
# Optional offline TTS engine: Wikidepia/indonesian-tts (VITS on Coqui TTS 0.8), CPU only.
# Needs conda (Python 3.10 - the system Python is too new for Coqui TTS 0.8). ~3 GB disk, a few GB of downloads.
# Creates ./.tts-env and downloads the v1.2 model (346 MB) into ./models/wikidepia-v1.2
# These steps are exactly what made it work on Ubuntu with Python 3.14 as the system Python (see notes inline).
set -e
cd "$(dirname "$0")/.."
CONDA="${CONDA:-$(command -v conda || echo "$HOME/miniforge3/bin/conda")}"
export TMPDIR="${TMPDIR_FOR_PIP:-$HOME/.cache/kamus-pip-tmp}"; mkdir -p "$TMPDIR"   # /tmp may be a small RAM disk
[ -x .tts-env/bin/python ] || "$CONDA" create -y -p .tts-env python=3.10 pip
P=.tts-env/bin/pip
# CPU-only torch + the matching torchaudio (otherwise pip pulls a huge CUDA build of a newer torch)
$P install torch==2.0.1 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu
# pyworld 0.2.10 (pinned by TTS) does not build from the sdist as shipped: patch one line, build without isolation
$P install "numpy<1.24" "cython<3" "setuptools==69.5.1" wheel     # setuptools<81 keeps pkg_resources, which numba needs
W=$(mktemp -d); URL=$(curl -s https://pypi.org/pypi/pyworld/0.2.10/json | python3 -c "import json,sys;print([u['url'] for u in json.load(sys.stdin)['urls'] if u['url'].endswith('.tar.gz')][0])")
curl -sSL "$URL" | tar xz -C "$W"
sed -i 's/__builtins__.__NUMPY_SETUP__ = False/import builtins; builtins.__NUMPY_SETUP__ = False/' "$W"/pyworld-0.2.10/setup.py
$P install --no-build-isolation "$W"/pyworld-0.2.10
$P install "TTS==0.8.0"
$P install --force-reinstall --no-build-isolation --no-deps "$W"/pyworld-0.2.10   # TTS pins numpy 1.22.4: rebuild pyworld against it
# Wikidepia's g2p-id (NOT the PyPI 'g2p-id-py', which is another project); it declares Python>=3.11 but works on 3.10
$P install python-crfsuite
$P install --no-deps --ignore-requires-python "git+https://github.com/Wikidepia/g2p-id"
mkdir -p models/wikidepia-v1.2 && cd models/wikidepia-v1.2
B=https://github.com/Wikidepia/indonesian-tts/releases/download/v1.2
for f in config.json speakers.pth checkpoint_1260000-inference.pth; do curl -L -C - -o "$f" "$B/$f"; done
cd ../..
# In-browser version of the same model: export to ONNX (needs the onnx package; ~121 MB file, served to browsers from /models/wikidepia/)
$P install "onnx==1.16.2"
.tts-env/bin/python scripts/export_wikidepia_onnx.py
.tts-env/bin/python scripts/check_wikidepia_onnx.py | grep -E "^'" | head -4     # sanity: ONNX output must equal PyTorch (corr 1.0000)
echo "Done. Restart the server and pick the engine in Settings."
